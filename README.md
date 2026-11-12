# IT HUB VR Arena · site web

Site statique (HTML, CSS, JavaScript, three.js inclus dans `vendor/`). Aucune installation ni compilation n'est nécessaire.

## Mettre le site en ligne sur Vercel

**Option A : avec GitHub (recommandé, mises à jour automatiques)**
1. Créez un dépôt vide sur github.com, par exemple `vr-arena-taza`.
2. Sur la page du dépôt, cliquez sur « uploading an existing file » et glissez tout le contenu de ce dossier (pas le dossier lui-même), puis « Commit changes ».
3. Sur vercel.com, connectez-vous avec GitHub, cliquez sur « Add New… › Project », choisissez le dépôt, laissez « Framework Preset » sur « Other », puis « Deploy ».
4. Vercel donne une adresse du type `vr-arena-taza.vercel.app` à partager.

**Option B : en ligne de commande**
```
npm i -g vercel
cd platform
vercel        # première mise en ligne (aperçu)
vercel --prod # version publique
```

## Réglages à faire avant l'ouverture

| Quoi | Où |
|---|---|
| Numéro WhatsApp de la salle (active l'envoi des réservations et des demandes) | `js/ui.js`, `WHATSAPP: ""` (format `2126XXXXXXXX`) |
| Prix (session, abonnement, anniversaire) | `js/ui.js` (`PRICE_SESSION`, `PRICE_SUB`, `PRICE_BDAY`), textes dans `js/i18n.js`, chiffres affichés dans les pages HTML |
| Disponibilités des casques | Actuellement simulées (démonstration) dans `js/reserve.js`, fonction `computeBooked`. À relier à une vraie base de données à l'ouverture. |
| Tous les textes du site | `js/i18n.js` : chaque texte existe en `fr`, `en` et `ar` |
| Adresse de la salle | `js/i18n.js`, clé `a6` |
| Lien Google Maps (lien « Itinéraire » du pied de page) | `js/ui.js`, `MAPS_URL` |

## Liens utiles
- `?lang=fr`, `?lang=en`, `?lang=ar` : ouvre le site dans une langue précise.
- `index.html?play` : ouvre directement le mode jeu.
- `experience.html?sc=bday` (ou `game`, `class`) : ouvre un scénario précis.
- `reserver.html?formule=sub` (ou `session`, `bday`) : présélectionne une formule.

## Pages
- `index.html` : accueil (histoire 3D au défilement, mode jeu, mini-jeu VR)
- `particuliers.html` : formules, catalogue, déroulé d'une visite, tournois
- `ecoles.html` : écoles et universités, laboratoires, demande de visite
- `entreprises.html` : développement sur mesure, formation, journées d'équipe, demande de devis
- `labo.html` : laboratoire R&D IT HUB (simulations, IA pour l'éducation, besoins du Maroc, demande de partenariat)
- `experience.html` : session en direct (partie, anniversaire, cours universitaire) avec l'écran des spectateurs et les temps
- `reserver.html` : réservation avec les casques 3D (Libre / Réservé / Votre choix)

## Structure
- `index.html` : la page
- `css/styles.css` : le style
- `js/i18n.js` : les textes en trois langues
- `js/ui.js` : menu, langues, réservation
- `js/room.js` : moteur 3D commun (salle, personnages, écran, monde VR)
- `js/world.js` : accueil (histoire, mode jeu, mini-jeu VR)
- `js/reserve.js` : réservation des casques
- `js/experience.js` : session en direct
- `vendor/three/` : la bibliothèque 3D three.js (version 0.160)
