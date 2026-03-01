# Simulateur Immo vs Location

Simulateur de patrimoine immobilier entièrement côté client — aucune installation, aucun serveur, aucune dépendance à installer. Ouvrez `index.html` dans votre navigateur et c'est tout.

## Objectif

Comparer l'évolution de votre patrimoine net sur le long terme selon deux stratégies :

- **Achat immobilier** — avec un ou plusieurs prêts (banque, PTZ, Action Logement), frais d'acquisition réalistes, charges de propriété et revalorisation du bien.
- **Location** — en plaçant l'apport non utilisé et en capitalisant le différentiel mensuel (ce que vous auriez payé en plus en étant propriétaire).

## Utilisation

Aucune installation requise. Double-cliquez sur `index.html` ou servez le dossier avec n'importe quel serveur HTTP statique.

```bash
# Exemple avec Python
python -m http.server 8080
```

## Fonctionnalités

### Paramètres globaux
- Salaire net mensuel, capital total disponible, apport dédié à l'achat
- Loyer actuel (utilisé pour le scénario locataire)
- Taux d'endettement maximum (20 – 45 %, défaut 35 %)
- Inflation annuelle, croissance de la valeur du bien, rendement épargne
- Durée de simulation (5 – 30 ans)

### Scénarios d'achat dynamiques
- Ajoutez et supprimez autant de scénarios que nécessaire
- Chaque scénario est indépendant : type (Ancien / Neuf), DPE (A à G), charges
- Bonus automatique −0,1 % sur le taux banque pour un bien neuf DPE A

### Prêts multiples par scénario
Chaque scénario peut combiner jusqu'à N prêts :

| Type | Paramètres |
|---|---|
| **Prêt bancaire** | Taux, durée, assurance emprunteur, frais d'agence, frais de garantie, frais de dossier, courtier |
| **PTZ** (Prêt à Taux Zéro) | Montant, durée, différé |
| **Action Logement** | Montant, taux, durée, différé |

Le simulateur calcule automatiquement un **échéancier lissé** : la mensualité bancaire s'ajuste mois par mois pour que la mensualité totale reste constante, même pendant les périodes où le PTZ ou l'Action Logement est actif.

### Calculs affichés pour chaque scénario
- Prix maximum du bien (résolution par bisection de la dépendance circulaire frais ↔ emprunt)
- Frais d'acquisition complets (notaire, agence, garantie, dossier, courtier)
- Budget mensuel détaillé : mensualité crédit, charges de copropriété, assurance habitation, provision travaux, taxe foncière
- Taux d'endettement effectif (crédit seul, conforme au calcul bancaire) et reste à vivre
- Analyse du prêt bancaire : coût nominal, coût réel actualisé à l'inflation, gain grâce à l'inflation, taux réel, valeur de la dernière mensualité en euros d'aujourd'hui
- Économies réalisées sur PTZ et Action Logement vs emprunt au taux banque
- Prévision patrimoniale à l'horizon de simulation

### Scénario locataire
- Placement de l'apport au taux de rendement épargne avec intérêts composés mensuels
- Capitalisation du différentiel mensuel (charges propriétaire − loyer) quand positif
- Évolution du loyer indexée sur l'inflation
- Détail complet du calcul : formule intérêts composés, décomposition capital / flux mensuels, jalons à 5, 10, 15, 20 ans

### Graphique et analyse
- Courbes de patrimoine net pour chaque scénario d'achat + courbe locataire (pointillé)
- Année de croisement (breakeven) affichée automatiquement

### Partage par lien
Le bouton **Partager** encode l'intégralité de l'état (inputs globaux + tous les scénarios) en Base64 dans le hash de l'URL et copie le lien dans le presse-papier. Quiconque ouvre ce lien retrouve exactement la même simulation.

## Architecture

```
index.html           — Squelette HTML + inputs globaux + canvas graphique
css/
  style.css          — Styles custom (sliders, toggles, cartes, sections détail)
js/
  finance.js         — Fonctions mathématiques pures (aucun DOM)
  chart-manager.js   — Wrapper Chart.js (palette, init, mise à jour)
  scenarios.js       — État des scénarios, rendu HTML, calculs
  main.js            — Orchestration, sérialisation/partage, initialisation
```

### Principes d'architecture

- **`scenarioList[]`** dans `scenarios.js` est la source de vérité *structurelle* (quels scénarios, quels prêts).
- **Le DOM** est la source de vérité *pour les valeurs* : tous les inputs sont lus depuis le DOM au moment du calcul.
- Avant tout re-rendu structurel, `saveAllCurrentValues()` synchronise le DOM → état pour ne pas perdre les valeurs en cours de saisie.
- Aucun bundler, aucun framework — scripts chargés dans l'ordre avec des balises `<script>` classiques.

### Algorithmes clés

**Bisection budget maximum** (`findMaxPropertyPrice`) — Le prix du bien `V` et les frais (notaire, agence) sont circulairement dépendants (les frais sont un pourcentage de `V`, mais `V` dépend des frais). La bisection converge en 60 itérations à moins de 0,50 € près.

**Lissage multi-prêts** (`computeSmoothedSchedule`) — Trouve par bisection le principal bancaire `B` tel que le prêt s'amortisse exactement à zéro en `N` mois, sachant que la mensualité bancaire varie selon les périodes où les prêts aidés (PTZ, AL) sont actifs.

**Taux d'endettement bancaire** — Seule la mensualité crédit (amortissement + intérêts + assurance emprunteur) entre dans le calcul du 35 %. Les charges de copropriété, taxe foncière et provision travaux impactent uniquement le reste à vivre.

**Partage** — `serializeState()` produit un JSON compact (tableau ordonné pour les inputs, format court `['b',…]`/`['p',…]`/`['a',…]` pour les prêts) encodé en Base64 via `btoa(unescape(encodeURIComponent(…)))` pour gérer les caractères accentués dans les noms de scénarios.

## Stack technique

| Élément | Détail |
|---|---|
| HTML / CSS / JS | Natif, ES2020, `'use strict'`, aucun module |
| CSS utilitaire | [Tailwind CSS](https://tailwindcss.com) via CDN |
| Graphique | [Chart.js 4.4](https://www.chartjs.org) via CDN |
| Dépendances runtime | Aucune — fonctionne entièrement hors ligne après le premier chargement des CDN |
