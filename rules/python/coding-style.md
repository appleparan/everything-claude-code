# Coding Style

## Immutability (CRITICAL)

Prefer immutable data, avoid in-place mutation:

```python
# WRONG: Mutation
def update_user(user: dict, name: str) -> dict:
    user["name"] = name  # MUTATION!
    return user

# CORRECT: Immutability
def update_user(user: dict, name: str) -> dict:
    return {**user, "name": name}
```

For dataclasses, use `frozen=True`:

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class User:
    name: str
    email: str
```

## File Organization

MANY SMALL FILES > FEW LARGE FILES:
- High cohesion, low coupling
- 200-400 lines typical, 800 max
- Extract utilities from large modules
- Organize by feature/domain, not by type

## Error Handling

ALWAYS handle errors comprehensively:

```python
try:
    result = risky_operation()
    return result
except SpecificError as e:
    logger.error("Operation failed: %s", e)
    raise RuntimeError("Detailed user-friendly message") from e
```

- Use `logging` module, not `print()`
- Catch specific exceptions, not bare `except`
- Chain exceptions with `from e`

## Input Validation

ALWAYS validate user input:

```python
from pydantic import BaseModel, EmailStr, Field

class UserInput(BaseModel):
    email: EmailStr
    age: int = Field(ge=0, le=150)

validated = UserInput.model_validate(raw_input)
```

## Type Hints

ALWAYS use type hints:

```python
def process_items(items: list[str], *, limit: int = 10) -> dict[str, int]:
    return {item: len(item) for item in items[:limit]}
```

- Use `ty check` for type verification
- Use modern syntax: `list[str]` not `List[str]`, `str | None` not `Optional[str]`

## Toolchain

- **Formatter**: `ruff format`
- **Linter**: `ruff check`
- **Type checker**: `ty check`
- **Test runner**: `pytest`
- **Package manager**: `uv` (never pip)

## Code Quality Checklist

Before marking work complete:
- [ ] Code is readable and well-named (snake_case)
- [ ] Functions are small (<50 lines)
- [ ] Files are focused (<800 lines)
- [ ] No deep nesting (>4 levels)
- [ ] Proper error handling with logging
- [ ] No print() statements (use logging)
- [ ] No hardcoded values
- [ ] Type hints on all public functions
- [ ] `ruff check` passes
- [ ] `ruff format` applied
- [ ] `ty check` passes
