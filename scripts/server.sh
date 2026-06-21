#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PID_FILE="$ROOT/.server.pid"
LOG_DIR="$ROOT/logs"
LOG_FILE="$LOG_DIR/server.log"
DEFAULT_PORT=3000

load_port() {
  local port="$DEFAULT_PORT"
  if [[ -f "$ROOT/.env" ]]; then
    local from_env
    from_env="$(grep -E '^[[:space:]]*PORT=' "$ROOT/.env" | tail -1 | cut -d= -f2- | tr -d '[:space:]"'"'"'')"
    if [[ -n "$from_env" ]]; then
      port="$from_env"
    fi
  fi
  echo "$port"
}

PORT="$(load_port)"

is_running_pid() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

pids_on_port() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true
    return
  fi
  if command -v fuser >/dev/null 2>&1; then
    fuser -n tcp "$PORT" 2>/dev/null | tr -s ' ' '\n' || true
    return
  fi
  ss -tlnp 2>/dev/null | awk -v port=":$PORT" '$4 ~ port { print $NF }' | grep -oP 'pid=\K[0-9]+' || true
}

pids_for_app() {
  pgrep -f "node( |.* )$ROOT/server/index.js" 2>/dev/null || true
}

stop_server() {
  local -a targets=()
  local pid pids

  if [[ -f "$PID_FILE" ]]; then
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if is_running_pid "$pid"; then
      targets+=("$pid")
    fi
  fi

  while IFS= read -r pid; do
    [[ -n "$pid" ]] && targets+=("$pid")
  done < <(pids_for_app | sort -u)

  while IFS= read -r pid; do
    [[ -n "$pid" ]] && targets+=("$pid")
  done < <(pids_on_port | sort -u)

  if [[ ${#targets[@]} -eq 0 ]]; then
    echo "Aucun serveur en cours (port $PORT)."
    rm -f "$PID_FILE"
    return 0
  fi

  mapfile -t targets < <(printf '%s\n' "${targets[@]}" | sort -u)

  echo "Arrêt du serveur (port $PORT)…"
  for pid in "${targets[@]}"; do
    kill "$pid" 2>/dev/null || true
  done

  for _ in {1..20}; do
    local still=0
    for pid in "${targets[@]}"; do
      if is_running_pid "$pid"; then
        still=1
        break
      fi
    done
    [[ "$still" -eq 0 ]] && break
    sleep 0.25
  done

  for pid in "${targets[@]}"; do
    if is_running_pid "$pid"; then
      echo "Forçage de l'arrêt (PID $pid)…"
      kill -9 "$pid" 2>/dev/null || true
    fi
  done

  rm -f "$PID_FILE"
  echo "Serveur arrêté."
}

start_server() {
  if [[ ! -d "$ROOT/node_modules" ]]; then
    echo "Installation des dépendances…"
    npm install
  fi

  local running
  running="$(pids_on_port | head -1 || true)"
  if [[ -n "$running" ]] && is_running_pid "$running"; then
    echo "Le serveur tourne déjà sur http://localhost:$PORT (PID $running)."
    echo "$running" > "$PID_FILE"
    return 0
  fi

  mkdir -p "$LOG_DIR"
  echo "Démarrage du serveur sur http://localhost:$PORT …"
  nohup node server/index.js >>"$LOG_FILE" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_FILE"

  for _ in {1..40}; do
    if curl -fsS "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
      echo "Serveur prêt (PID $pid)."
      echo "Logs : $LOG_FILE"
      return 0
    fi
    if ! is_running_pid "$pid"; then
      echo "Échec du démarrage. Dernières lignes du log :" >&2
      tail -n 20 "$LOG_FILE" >&2 || true
      rm -f "$PID_FILE"
      return 1
    fi
    sleep 0.25
  done

  echo "Serveur lancé (PID $pid) mais la sonde HTTP n'a pas répondu à temps."
  echo "Consultez les logs : $LOG_FILE"
}

status_server() {
  local pid
  pid="$(pids_on_port | head -1 || true)"
  if [[ -n "$pid" ]] && is_running_pid "$pid"; then
    echo "En ligne — http://localhost:$PORT (PID $pid)"
    return 0
  fi
  echo "Hors ligne — port $PORT libre."
  return 1
}

usage() {
  cat <<EOF
Usage : $(basename "$0") {start|stop|restart|status}

  start    Démarre le serveur en arrière-plan
  stop     Arrête le serveur proprement
  restart  Redémarre le serveur (stop puis start)
  status   Indique si le serveur répond sur le port $PORT
EOF
}

cmd="${1:-}"
case "$cmd" in
  start) start_server ;;
  stop) stop_server ;;
  restart)
    stop_server
    start_server
    ;;
  status) status_server ;;
  *)
    usage
    exit 1
    ;;
esac