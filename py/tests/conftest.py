import sys
from pathlib import Path

# The helper is not an installed package (tool.uv.package = false); import it from py/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
