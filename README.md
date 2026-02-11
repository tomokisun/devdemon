# devdemon

Autonomous AI agent daemon powered by Claude Code.

## Install

Requires [Bun](https://bun.sh).

```sh
bun install
bun link
```

`bun link` registers the `devdemon` command globally so you can run it from anywhere.

## Usage

```sh
# Start the daemon
devdemon

# Start with a specific role
devdemon -r swe

# Specify a repository to work on
devdemon --repo /path/to/repo

# Dry run (render UI without starting daemon)
devdemon --dry-run
```

### Options

```
-r, --role <name>         Role name to use
    --repo <path>         Repository path to work on
    --roles-dir <path>    Custom roles directory
-i, --interval <seconds>  Override interval in seconds
-v, --verbose             Enable verbose output
    --dry-run             Render UI without starting daemon
```

### Subcommands

```
devdemon roles    # Manage roles
devdemon init     # Initialize project
devdemon config   # Configuration management
```

### Built-in Roles

- **swe** - Software Engineer
- **pm** - Product Manager

## Development

```sh
bun run start           # Start the daemon
bun test                # Run tests
bun test --coverage     # Run tests with coverage
bun test --watch        # Watch mode
```

## License

MIT
