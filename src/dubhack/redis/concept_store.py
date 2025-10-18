import redis


class ConceptStore:
    """A barebones Redis key-value store for Markdown concept pages."""

    def __init__(self, redis_client: redis.Redis):
        self.r = redis_client

    def create_concept(self, name: str, content: str) -> None:
        """Insert a new concept if it doesn't exist."""
        key = f"concept:{name}"
        if self.r.exists(key):
            raise ValueError(f"Concept '{name}' already exists.")

        self.r.set(key, content)

    def read_concept(self, name: str) -> str | None:
        """Fetch the Markdown content of a concept."""
        key = f"concept:{name}"
        return self.r.get(key)

    def update_concept(self, name: str, content: str) -> None:
        """Overwrite or create a concept entry."""
        key = f"concept:{name}"
        self.r.set(key, content)

    def delete_concept(self, name: str) -> None:
        """Remove a concept."""
        key = f"concept:{name}"
        self.r.delete(key)

    def reset(self) -> None:
        """Wipe all data (demo reset)."""
        self.r.flushall()


if __name__ == "__main__":
    r = redis.Redis(host="localhost", port=6379, decode_responses=True)
    store = ConceptStore(r)

    # CREATE
    markdown_text = """# Linear Regression
    Linear regression models the relationship between variables by fitting a linear equation.
    - **Formula:** y = a + b*x
    - **Use case:** prediction and trend analysis
    """
    store.create_concept("linear_regression", markdown_text)

    # READ
    print(store.read_concept("linear_regression"))

    # UPDATE
    store.update_concept(
        "linear_regression", markdown_text + "\n\n### Notes\nThis is a demo update."
    )

    # DELETE
    store.delete_concept("linear_regression")

    # RESET
    store.reset()
