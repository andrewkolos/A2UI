# SurfaceModel generic typing

A type-checker demonstration for a proposed change to the Python core SDK:
making `SurfaceModel` generic over its catalog's component and function type
parameters, instead of holding `Catalog[Any, Any]`.

The `Any` erasure hides the function kind from all downstream code. Threading
the parameters through `SurfaceModel` recovers it, and it composes with a
distinction the catalog already draws between `FunctionApi` (a signature) and
`FunctionImplementation` (a signature with executable logic).

## Files

- **`surfacemodel_generic.py`** shows four things a generic `SurfaceModel`
  buys, verified against `mypy --strict`:
  1. the catalog's component and function types survive (`.functions` is
     `list[FunctionImplementation]`, not `list[Any]`);
  2. a consumer that requires executable functions can bound its own parameter
     to `FunctionImplementation`, so a schema-only surface is a type error
     rather than a tree of runtime `None`s;
  3. Python generics are invariant, so "accepts any surface regardless of
     function kind" needs a covariant parameter, not the invariant default;
  4. a *partially* implemented catalog still type-checks, so a completeness
     check stays a runtime concern.

- **`nonbreaking_defaults.py`** shows that giving the parameters PEP 696
  defaults keeps every existing bare `SurfaceModel` reference valid, so the
  change is additive.

## Running

```
mypy --strict experiments/python-typing/surfacemodel_generic.py
mypy --strict --python-version 3.13 experiments/python-typing/nonbreaking_defaults.py
```

Each file's module docstring lists the exact expected output. In the first
file, two of the lines are intentional errors: they are the type system
catching the schema-only catalog and the invariance boundary.
