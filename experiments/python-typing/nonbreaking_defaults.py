"""Giving the new type parameters defaults keeps the change non-breaking.

If ``SurfaceModel`` gains two type parameters, every existing bare
``SurfaceModel`` reference would otherwise need updating. PEP 696 parameter
defaults avoid that: a bare reference resolves to the default kinds and keeps
type-checking, so the migration is additive.

Run (defaults are honored on Python 3.13 semantics; typing_extensions backports
the syntax to older runtimes):

    mypy --strict --python-version 3.13 \\
        experiments/python-typing/nonbreaking_defaults.py

Expected output:

    note: Revealed type is "builtins.list[...FunctionImplementation]"
    Success: no issues found in 1 source file
"""
from typing import Any, Generic, List

from typing_extensions import TypeVar


class ComponentApi: ...


class FunctionApi: ...


class FunctionImplementation(FunctionApi): ...


TComponent = TypeVar("TComponent", bound=ComponentApi, default=ComponentApi)
TFunction = TypeVar("TFunction", bound=FunctionApi, default=FunctionImplementation)


class Catalog(Generic[TComponent, TFunction]):
    def __init__(self, functions: List[TFunction]) -> None:
        self.functions = functions


class SurfaceModel(Generic[TComponent, TFunction]):
    def __init__(self, catalog: Catalog[TComponent, TFunction]) -> None:
        self.catalog = catalog


# A bare ``SurfaceModel`` (no parameters), as existing call sites write it,
# still type-checks and resolves the function kind to the default.
def takes_bare(surface: SurfaceModel) -> None:
    reveal_type(surface.catalog.functions)  # list[FunctionImplementation]
