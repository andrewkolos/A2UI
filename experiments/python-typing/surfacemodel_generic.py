"""Making ``SurfaceModel`` generic over its catalog's type parameters.

Today ``SurfaceModel`` holds ``catalog: Catalog[Any, Any]``, which erases the
component and function types: downstream code can't see that a catalog's
functions are ``FunctionImplementation`` rather than bare ``FunctionApi``.
Threading the two type parameters through ``SurfaceModel`` recovers them.

Run:

    mypy --strict experiments/python-typing/surfacemodel_generic.py

Expected output (two reveals, two intentional errors):

    note: Revealed type is "...Catalog[ComponentApi, FunctionImplementation]"
    note: Revealed type is "builtins.list[...FunctionImplementation]"
    error: Value of type variable "FImpl" of "NodeResolver" cannot be
           "FunctionApi"  [type-var]
    error: Argument 1 to "wants_any_surface" has incompatible type
           "SurfaceModel[ComponentApi, FunctionImplementation]"; expected
           "SurfaceModel[ComponentApi, FunctionApi]"  [arg-type]

The two errors are the demonstration, not a failure: they are the type system
catching a schema-only catalog and the invariance boundary.
"""
from typing import Any, Dict, Generic, List, TypeVar


class ComponentApi:
    def __init__(self, name: str, schema: Dict[str, Any]) -> None: ...


class FunctionApi:
    """A function signature with no executable body."""

    def __init__(self, name: str, schema: Any) -> None: ...


class FunctionImplementation(FunctionApi):
    """A function signature paired with executable logic."""

    def execute(self, args: Dict[str, Any]) -> Any: ...


TComponent = TypeVar("TComponent", bound=ComponentApi)
TFunction = TypeVar("TFunction", bound=FunctionApi)


class Catalog(Generic[TComponent, TFunction]):
    def __init__(self, components: List[TComponent], functions: List[TFunction]) -> None:
        self.components = components
        self.functions = functions


class SurfaceModel(Generic[TComponent, TFunction]):
    """Generic over both catalog parameters (the proposed change)."""

    def __init__(self, catalog: Catalog[TComponent, TFunction]) -> None:
        self.catalog = catalog


# 1. The types are recovered: the catalog and its functions keep their kinds
#    instead of collapsing to Any.
impl_catalog: Catalog[ComponentApi, FunctionImplementation] = Catalog([], [])
impl_surface = SurfaceModel(impl_catalog)
reveal_type(impl_surface.catalog)
reveal_type(impl_surface.catalog.functions)


# 2. A component that requires executable functions (like a node resolver) can
#    demand them in its own bound; a schema-only surface is then rejected at
#    type-check time rather than resolving to None at runtime.
CImpl = TypeVar("CImpl", bound=ComponentApi)
FImpl = TypeVar("FImpl", bound=FunctionImplementation)


class NodeResolver(Generic[CImpl, FImpl]):
    def __init__(self, surface: SurfaceModel[CImpl, FImpl]) -> None:
        self.surface = surface


NodeResolver(impl_surface)  # accepted: functions are implementations

schema_only_catalog: Catalog[ComponentApi, FunctionApi] = Catalog([], [])
schema_only_surface = SurfaceModel(schema_only_catalog)
NodeResolver(schema_only_surface)  # rejected: FunctionApi does not satisfy the bound


# 3. Python generics are invariant, so a surface of implementations is NOT a
#    surface of bare signatures. Code that means "any surface regardless of
#    function kind" cannot be written with an invariant FunctionApi parameter;
#    that would need a covariant parameter (and read-only function access).
def wants_any_surface(surface: SurfaceModel[ComponentApi, FunctionApi]) -> None: ...


wants_any_surface(impl_surface)  # rejected under invariance


# 4. Types cannot catch a *partially* implemented catalog: the element type says
#    every function is an implementation, not which names are present. A catalog
#    that declares five functions but registers four still type-checks, so the
#    completeness check stays a runtime concern.
partial: Catalog[ComponentApi, FunctionImplementation] = Catalog(
    [], [FunctionImplementation("a", None)]
)
NodeResolver(SurfaceModel(partial))  # accepted, even if a payload calls "b"
