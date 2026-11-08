import shutil
import subprocess
import sys
from pathlib import Path


def main() -> int:
    project_dir = Path(__file__).resolve().parent
    npm = shutil.which("npm")
    if npm is None:
        print("Node.js et npm sont nécessaires pour lancer Coffee 101.", file=sys.stderr)
        return 1
    if not (project_dir / "node_modules" / "vite").is_dir():
        print("Installe d'abord les dépendances avec : npm install", file=sys.stderr)
        return 1

    print("Démarrage de Coffee 101. Pour arrêter le serveur, appuie sur Ctrl+C.", flush=True)
    try:
        return subprocess.call([npm, "run", "dev", "--", "--open"], cwd=project_dir)
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    sys.exit(main())