"""Compile-time guard that a generic ``SurfaceModel`` recovers catalog types.

With ``SurfaceModel`` generic over its catalog's component and function
parameters, code that holds a concrete surface can read the catalog's kinds
instead of ``Any``. ``assert_type`` makes this self-checking: the type checker
passes only if the types are genuinely recovered, and reports an error if a
future change collapses them back to ``Any``.

This file is checked by the repository's mypy run (it lives outside the
excluded ``tests/`` tree), so a regression fails CI.
"""
from typing import Dict

from typing_extensions import assert_type

from a2ui.core.catalog import Catalog, ComponentApi, FunctionImplementation
from a2ui.core.state import SurfaceModel


def reads_catalog(
    surface: SurfaceModel[ComponentApi, FunctionImplementation],
) -> None:
    # The catalog keeps both kinds instead of collapsing to Catalog[Any, Any].
    assert_type(surface.catalog, Catalog[ComponentApi, FunctionImplementation])
    # A function looked up from it is a FunctionImplementation, with .execute
    # reachable, rather than Any: the schema access the type system now permits.
    assert_type(surface.catalog.functions, Dict[str, FunctionImplementation])
