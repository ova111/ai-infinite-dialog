# AI Infinite Dialog

> **Système de retour AI Infinite Dialog** — Permet à l'IA de demander proactivement à l'utilisateur s'il souhaite continuer après avoir terminé une tâche, créant une véritable boucle de collaboration humain-IA.

Conçu pour l'IDE **Windsurf**.

🌐 **Langue** : [中文](README.md) | [English](README.en.md) | **Français** | [Español](README.es.md)

---

## Fonctionnalités

### Fonctionnalités principales
- **Boucle de dialogue infinie** : L'IA affiche automatiquement un panneau de retour après avoir terminé une tâche, l'utilisateur choisit « Continuer » ou « Terminer »
- **Injection de règles globales** : Injecte automatiquement les règles de comportement IA dans l'IDE (normes de codage, processus de demande, etc.)
- **Service HTTP** : Service HTTP léger intégré, l'IA appelle l'interface de retour via `curl`
- **Rendu Markdown** : Le panneau de retour supporte entièrement Markdown, la coloration syntaxique et l'affichage d'images

### Fonctionnalités de gestion
- Panneau de contrôle dans la barre latérale (démarrer/arrêter/redémarrer le service)
- Affichage en temps réel de l'état du service
- Statistiques d'utilisation (nombre d'appels, compteurs continuer/terminer)
- Visualisation des logs
- Export/import de configuration

### Fonctionnalités avancées
- Scan automatique des ports (éviter les conflits)
- Édition personnalisée des règles
- Raccourcis clavier

## Fonctionnement

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    IA        │────▶│ Serveur HTTP│────▶│  Panneau de  │
│ (Cascade)    │     │ (Port 3456) │     │  retour      │
└─────────────┘     └─────────────┘     └─────────────┘
       ▲                                       │
       │        Retour utilisateur             │
       └───────────────────────────────────────┘
```

1. **L'IA appelle l'outil** : Après avoir terminé une tâche, l'IA appelle `infinite_dialog_feedback` via HTTP
2. **Le service traite la requête** : Le service HTTP de l'extension reçoit la requête et affiche le panneau de retour
3. **Affichage de la réponse** : Le panneau WebView rend la réponse Markdown de l'IA
4. **L'utilisateur fait son choix** : L'utilisateur choisit « Continuer » ou « Terminer la conversation »
5. **Le retour est envoyé à l'IA** : Le choix de l'utilisateur et les instructions supplémentaires sont renvoyés à l'IA via la réponse HTTP

## Installation

### Méthode 1 : Installer depuis VSIX (Recommandé)

Téléchargez le dernier fichier `.vsix` depuis la page [Releases](https://github.com/ova111/ai-infinite-dialog/releases), puis :

```bash
code --install-extension ai-infinite-dialog-x.x.x.vsix
```

Ou dans l'IDE : `Ctrl+Shift+P` → `Install from VSIX...` → sélectionnez le fichier téléchargé.

### Méthode 2 : Compiler depuis les sources

```bash
git clone https://github.com/ova111/ai-infinite-dialog.git
cd ai-infinite-dialog
npm install
npm run package
# Le fichier .vsix sera à la racine du projet
```

### Méthode 3 : Mode développement

```bash
git clone https://github.com/ova111/ai-infinite-dialog.git
cd ai-infinite-dialog
npm install
npm run watch
# Appuyez sur F5 pour lancer le débogage
```

## Utilisation

### 1. Démarrer l'extension

L'extension s'active automatiquement au démarrage de l'IDE et :
- Démarre le service HTTP (port 3456 par défaut)
- Injecte les règles IA globales
- Affiche l'état du service dans la barre d'état

### 2. Appel automatique de l'IA

Lorsque l'IA termine une tâche, elle appelle automatiquement l'outil `infinite_dialog_feedback`, affichant le panneau de retour.

### 3. Interaction utilisateur

Dans le panneau de retour :
- Consultez la réponse de l'IA (rendu Markdown + coloration syntaxique)
- Saisissez des instructions supplémentaires (optionnel)
- Téléchargez/collez des images (optionnel)
- Cliquez sur « Continuer » pour poursuivre la conversation, ou « Terminer » pour arrêter

## Commandes

| Commande | Description |
|----------|-------------|
| `AI Dialog : Démarrer le serveur MCP` | Démarrer manuellement le service HTTP |
| `AI Dialog : Arrêter le serveur MCP` | Arrêter le service HTTP |
| `AI Dialog : Ouvrir les paramètres` | Ouvrir le panneau de paramètres |
| `AI Dialog : Configurer l'IDE` | Reconfigurer l'IDE |
| `AI Dialog : Injecter les règles globales` | Réinjecter les règles IA |
| `AI Dialog : Éditer les règles` | Éditer le fichier de règles IA |
| `AI Dialog : Voir les logs` | Ouvrir le panneau de logs |
| `AI Dialog : Afficher le statut` | Voir l'état du service |

## Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| `Cmd/Ctrl + Shift + D` | Ouvrir le panneau de paramètres |
| `Cmd/Ctrl + Shift + S` | Démarrer le service (quand il n'est pas en cours) |
| `Ctrl/Cmd + Entrée` | Continuer la conversation (dans le panneau de retour) |
| `Échap` | Terminer la conversation (dans le panneau de retour) |

## Configuration

Recherchez `ai-infinite-dialog` dans les paramètres de l'IDE :

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `autoStart` | boolean | `true` | Démarrage auto du service HTTP |
| `autoConfigureIDE` | boolean | `true` | Auto-configuration de l'IDE |
| `autoInjectRules` | boolean | `true` | Auto-injection des règles IA globales |
| `serverPort` | number | `3456` | Port du service HTTP |
| `targetIDE` | string | `"windsurf"` | IDE cible |
| `showNotifications` | boolean | `true` | Afficher les notifications |

## Structure du projet

```
ai-infinite-dialog/
├── src/
│   ├── extension.ts        # Point d'entrée, activation/désactivation
│   ├── mcpServer.ts        # Service HTTP, gestion des appels d'outils IA
│   ├── feedbackPanel.ts    # Panneau de retour WebView
│   ├── ruleInjector.ts     # Injection de règles IA (Windsurf)
│   ├── configManager.ts    # Gestion de la configuration IDE
│   ├── sidebarProvider.ts  # Panneau de paramètres latéral
│   ├── settingsPanel.ts    # Panneau de paramètres indépendant
│   ├── logManager.ts       # Gestion des logs
│   ├── statsManager.ts     # Statistiques d'utilisation
│   └── i18n/               # Internationalisation (zh, en, fr, es)
├── resources/
│   └── icon.svg            # Icône de l'extension
├── package.json
├── tsconfig.json
├── LICENSE                 # Licence MIT
├── CHANGELOG.md
└── README.md
```

## Développement

```bash
# Installer les dépendances
npm install

# Compiler
npm run compile

# Mode surveillance (compilation auto)
npm run watch

# Vérification du code
npm run lint

# Empaqueter VSIX
npm run package
```

## Règles IA injectées

L'extension injecte automatiquement les règles de comportement IA suivantes :

- **Appel de l'interface de retour** : L'IA doit appeler l'interface de retour avant la fin de chaque réponse
- **Demander avant d'exécuter** : Expliquer le problème, proposer des solutions et attendre le choix de l'utilisateur avant de modifier le code
- **Normes de codage** : Qualité du code, gestion des erreurs, codage sécurisé, maintenabilité, etc.
- **Réessai en cas d'échec** : Réessai automatique 3 fois en cas d'échec d'appel d'interface

Emplacement du fichier de règles : `~/.codeium/windsurf/memories/user_global.md`

## Contribuer

Les Issues et Pull Requests sont les bienvenues !

1. Forkez ce dépôt
2. Créez une branche de fonctionnalité : `git checkout -b feature/votre-fonctionnalite`
3. Committez vos changements : `git commit -m 'Ajout de votre fonctionnalité'`
4. Poussez la branche : `git push origin feature/votre-fonctionnalite`
5. Soumettez une Pull Request

## Licence

[MIT](LICENSE) © 2024-2026 AI Infinite Dialog
