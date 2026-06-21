# Météo France — PetiK

Application web personnelle de consultation météo, basée sur les APIs officielles de [Météo France](https://portail-api.meteofrance.fr). Elle propose des **prévisions par ville** et l'exploration des **stations d'observation** sur tout le territoire français.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![Express](https://img.shields.io/badge/Express-4-blue)
![Licence](https://img.shields.io/badge/licence-MIT-lightgrey)

---

## Fonctionnalités

### Onglet Prévisions

- **Recherche de ville** avec suggestions automatiques
- **Géolocalisation** pour afficher la météo à votre position
- **Villes favorites** (jusqu'à 8), mémorisées dans le navigateur
- **Raccourcis** : Paris, Lyon, Marseille, Bordeaux, Toulouse
- **Conditions actuelles** : température, pictogramme, vent, humidité, UV, lever/coucher du soleil
- **Prévisions sur 7 jours** et **prévisions horaires** (24 h ou 48 h)
- **Graphiques** température, vent et précipitations
- **Probabilités** de pluie, neige et gel
- **Pluie dans l'heure** : frise minute par minute
- **Vigilance météo** :
  - Cartes nationales **aujourd'hui** et **demain** (vignettes Météo France)
  - **Alertes départementales** (vent, orages, canicule, etc.) affichées à côté des cartes
- **Mode sombre / clair**
- **Mode hors ligne** : dernières données consultées conservées en cache local

### Onglet Stations

- Catalogue de **14 000+ stations** Météo France (source [data.gouv.fr](https://www.data.gouv.fr))
- Recherche par **nom de station**
- Filtre par **département** (108 départements : métropole, Corse, DOM-TOM)
- Recherche des **stations proches** via géolocalisation
- **Favoris stations** (jusqu'à 8)
- **Cartes OpenStreetMap** (Leaflet) pour les résultats et le détail d'une station
- **Mesures en direct** et **historique** (horaire ou 6 minutes) — nécessite une clé API DPObs
- Graphiques d'historique sur 24 h ou 48 h

### Progressive Web App (PWA)

- Installable sur mobile et bureau
- Service Worker pour le cache des fichiers statiques
- Manifeste web (`manifest.json`)

---

## Prérequis

- **Node.js** 18 ou supérieur
- **npm**
- Un compte sur le [portail API Météo France](https://portail-api.meteofrance.fr)

---

## Installation

```bash
git clone https://github.com/petikvx/meteo-france-ptk.git
cd meteo-france-ptk
npm install
cp .env.example .env
```

Éditez ensuite le fichier `.env` avec vos clés (voir ci-dessous).

---

## Configuration

Créez un fichier `.env` à la racine du projet :

```env
# Token API Prévisions (obligatoire)
METEOFRANCE_TOKEN=votre_token_ici

# Clé API DPObs — observations stations (optionnel)
METEOFRANCE_API_KEY=votre_cle_api_ici

# Port du serveur (optionnel, défaut : 3000)
PORT=3000
```

### Obtenir le token Prévisions (`METEOFRANCE_TOKEN`)

1. Créez un compte sur [portail-api.meteofrance.fr](https://portail-api.meteofrance.fr)
2. Abonnez-vous à l'API **Prévisions**
3. Récupérez votre **token** dans la section « Mes APIs »
4. Ce token sert aussi aux **vignettes de vigilance météo**

### Obtenir la clé DPObs (`METEOFRANCE_API_KEY`) — optionnel

Sans cette clé, l'onglet Stations reste utilisable (recherche, carte, fiches), mais les **mesures en direct** et l'**historique** ne seront pas disponibles.

1. Sur le même portail, abonnez-vous à **Données d'observation** (DPObs v1)
2. Générez une **clé API** (API Key)
3. Ajoutez-la dans `.env`

> Ne commitez **jamais** votre fichier `.env` : il est déjà ignoré par Git.

---

## Lancement

### Démarrage simple

```bash
npm start
```

L'application est accessible sur [http://localhost:3000](http://localhost:3000).

### Mode développement (rechargement auto)

```bash
npm run dev
```

### Scripts bash (arrêt / redémarrage)

Des scripts sont fournis pour gérer le serveur en arrière-plan :

```bash
./stop.sh              # arrête le serveur
./restart.sh           # redémarre proprement
./scripts/server.sh start    # démarre en arrière-plan
./scripts/server.sh status   # vérifie l'état du serveur
```

Les logs sont écrits dans `logs/server.log`.

---

## Architecture

```
meteo-france-ptk/
├── public/                 # Frontend (HTML, CSS, JS)
│   ├── index.html
│   ├── css/style.css
│   ├── js/
│   │   ├── app.js          # Prévisions, vigilance, navigation
│   │   ├── stations.js     # Onglet stations
│   │   ├── map.js          # Cartes Leaflet / OSM
│   │   ├── charts.js       # Graphiques SVG
│   │   ├── departments.js  # Liste des départements
│   │   ├── storage.js      # localStorage (favoris, thème…)
│   │   └── pictos.js       # Pictogrammes météo
│   ├── sw.js               # Service Worker
│   └── manifest.json       # PWA
├── server/
│   ├── index.js            # Serveur Express + routes API
│   └── lib/
│       ├── stations.js     # Catalogue stations (CSV data.gouv.fr)
│       ├── dpobs.js        # Proxy API DPObs
│       └── vigilance.js    # Vignettes vigilance
├── scripts/server.sh       # Gestion du serveur
├── stop.sh
├── restart.sh
├── .env.example
└── package.json
```

### Stack technique

| Couche      | Technologie                          |
|-------------|--------------------------------------|
| Backend     | Node.js, Express                     |
| Frontend    | HTML, CSS, JavaScript (vanilla, ES modules) |
| Cartes      | Leaflet + tuiles OpenStreetMap       |
| Données     | APIs Météo France, data.gouv.fr      |
| Cache       | Service Worker + localStorage        |

---

## Routes API internes

Le serveur Express sert de **proxy** vers les APIs Météo France (le token reste côté serveur).

| Route | Description |
|-------|-------------|
| `GET /api/places?q=` | Recherche de lieux |
| `GET /api/forecast?lat=&lon=` | Prévisions |
| `GET /api/observation?lat=&lon=` | Observation grille |
| `GET /api/rain?lat=&lon=` | Pluie dans l'heure |
| `GET /api/warning?dept=` | Alertes vigilance département |
| `GET /api/vigilance/thumbnail?day=today\|tomorrow` | Carte vigilance (PNG) |
| `GET /api/stations?q=&dept=` | Recherche de stations |
| `GET /api/stations/:id` | Détail d'une station |
| `GET /api/stations/:id/observations` | Mesures DPObs (clé requise) |
| `GET /api/stations/status` | État du catalogue et de la clé DPObs |

---

## Données et attributions

- **Prévisions, observations grille, vigilance** : [Météo France](https://www.meteofrance.fr) — [portail-api.meteofrance.fr](https://portail-api.meteofrance.fr)
- **Catalogue des stations** : [data.gouv.fr — Stations Météo France](https://www.data.gouv.fr/fr/datasets/stations-meteo-france/)
- **Cartes** : © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors

Les données météorologiques sont soumises aux conditions d'utilisation de Météo France. Cette application est un projet personnel et n'est pas affiliée à Météo France.

---

## Auteur

**PetiK** — © 2026

Ce projet a été développé avec l'aide de **Grok** (xAI), assistant IA intégré à Cursor, pour la conception, l'implémentation et les itérations de l'application.

---

## Licence

Code source : licence MIT (à confirmer selon vos préférences).

Les données météorologiques restent la propriété de leurs éditeurs respectifs.