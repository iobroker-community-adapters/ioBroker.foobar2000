# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.0
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

### Adapter-Specific Context: Foobar2000 Player Control

This is the **ioBroker.foobar2000** adapter - a multimedia adapter that provides control interface for the Foobar2000 audio player. Key characteristics:

- **Primary Function**: Controls Foobar2000 media player via HTTP API using the foo_httpcontrol plugin
- **Communication Method**: HTTP GET requests to Foobar2000's web interface (default port 8888)
- **Key Features**: Playback control, volume management, playlist handling, track information, album art display
- **Operation Modes**: Local (direct file system access) and Remote (network-based control)
- **State Polling**: Regular HTTP polling to maintain current player state
- **Media States**: Comprehensive media player state management (play/pause/stop, seek, shuffle, repeat)

### Required External Components

- **foo_httpcontrol Plugin**: Must be installed in Foobar2000 for HTTP API access
- **Configuration Note**: Album art requires `albumart_prefer_embedded = 0` in foobar2000controller config

## Testing

### Unit Testing
- Use Jest as the primary testing framework for ioBroker adapters
- Test files should be placed in the `test/` directory
- Use `@iobroker/testing` library for adapter-specific test utilities
- Mock external HTTP calls to Foobar2000 player during testing

### Integration Testing
- Test actual HTTP communication with mock Foobar2000 instance
- Validate state synchronization between adapter and player
- Test error handling for network connectivity issues

### Test Coverage Areas for Foobar2000 Adapter
- HTTP request handling and error recovery
- Media state parsing and transformation
- Playlist management operations
- Volume control and mute functionality
- Album art URL generation and caching

## Code Style and Best Practices

### General JavaScript/TypeScript Guidelines
- Use ESLint with the ioBroker configuration
- Follow semantic naming conventions for states and methods
- Use async/await for asynchronous operations
- Implement proper error handling with try-catch blocks
- Use TypeScript type definitions for better code safety

### ioBroker Adapter Specific Guidelines
- Always use `this.setState()` for updating adapter states
- Use appropriate logging levels: `error`, `warn`, `info`, `debug`
- Implement graceful shutdown in the `unload()` method
- Use `this.log.debug()` for detailed operational information
- Follow ioBroker state naming conventions (e.g., `info.connection`)

### HTTP Communication Patterns for Foobar2000
- Implement connection retry logic with exponential backoff
- Handle network timeouts gracefully (default 5 seconds)
- Parse JSON responses safely with error handling
- Cache frequently accessed data (like playlist information)
- Validate HTTP response status codes before processing

## Architecture Patterns

### Core ioBroker Patterns
- Extend from `utils.Adapter` base class
- Use the adapter lifecycle methods: `ready()`, `unload()`, `stateChange()`
- Implement connection state management via `info.connection`
- Use adapter configuration from `this.config`

### State Management for Media Players
- Implement polling mechanism for real-time state updates
- Use state-based architecture for media player controls
- Handle simultaneous user interactions gracefully
- Maintain consistent state between adapter and external player

### Foobar2000 Specific Patterns
```javascript
// HTTP command execution pattern
async executeCommand(command, param) {
    try {
        const response = await this.httpGet(command, [param]);
        if (response && response.data) {
            return response.data;
        }
    } catch (error) {
        this.log.error(`Command ${command} failed: ${error.message}`);
        this.setStateChanged('info.connection', false, true);
    }
}

// Media state update pattern  
updateMediaState(playerData) {
    if (playerData.isplaying) {
        this.setState('state', 'play', true);
    } else if (playerData.ispaused) {
        this.setState('state', 'pause', true); 
    } else {
        this.setState('state', 'stop', true);
    }
}
```

## Error Handling

### Network Error Handling
- Implement connection monitoring and automatic reconnection
- Handle HTTP timeouts and connection refused errors
- Provide meaningful error messages to users
- Set connection state appropriately on network issues

### Data Validation
- Validate HTTP response structure before processing
- Handle missing or malformed player data gracefully
- Sanitize user inputs for security
- Check parameter bounds (volume: 0-100, seek: 0-100%)

### Foobar2000 Specific Error Scenarios
- Player not running or plugin not installed
- Invalid command parameters or unsupported operations
- File system access errors in local mode
- Playlist or track access permissions

## Configuration and Setup

### Adapter Configuration Structure
```javascript
// Native configuration object structure
{
    ip: "127.0.0.1",           // Foobar2000 server IP
    port: 8888,                // HTTP control port  
    login: "",                 // Optional authentication
    password: "",              // Optional password
    path: "C:/Program Files (x86)/foobar2000/", // Local installation path
    cmdstart: "",              // Start command for local mode
    cmdexit: ""                // Exit command for local mode
}
```

### Connection Management
- Detect local vs remote operation mode based on IP address
- Handle authentication if credentials are provided
- Validate connection parameters on adapter start
- Implement connection health checks

## State Definitions and Media Controls

### Core Media States
- `state`: Current playback state (play/pause/stop/next/previous)
- `volume`: Volume level (0-100%)
- `mute`: Mute state (boolean)
- `seek`: Playback position (0-100%)

### Track Information States  
- `title`: Current track title
- `artist`: Current track artist
- `album`: Current track album
- `albumArt`: Album art URL or file path

### Playlist and Control States
- `playlist`: Current playlist data (JSON string)
- `itemPlaying`: Currently playing track number
- `repeat`: Repeat mode (Off/All/One)
- `shuffle`: Shuffle state (boolean)

## Dependencies and Compatibility

### Core Dependencies
- `@iobroker/adapter-core`: ^3.1.6 (adapter foundation)
- Node.js 18+ (minimum supported version)
- js-controller >= 5.0.19 (ioBroker controller requirement)

### Development Dependencies
- `@iobroker/testing`: Testing utilities for adapters
- `eslint`: Code quality and style enforcement
- `mocha`: Test runner for unit and integration tests

### External Requirements
- Foobar2000 media player with foo_httpcontrol plugin
- Network connectivity for remote operation mode
- File system access permissions for local mode operations

## Logging and Debugging

### Logging Best Practices
- Use appropriate log levels consistently
- Include context information in error messages
- Log connection state changes for troubleshooting
- Avoid logging sensitive information (passwords, tokens)

### Debug Information for Media Operations
- Log HTTP request/response details at debug level
- Track state change events with timestamps
- Monitor polling frequency and performance metrics
- Record playlist and track change operations

### Troubleshooting Common Issues
- Connection timeout: Check network connectivity and firewall settings
- Authentication errors: Verify credentials and HTTP control plugin config
- State synchronization issues: Check polling interval and error handling
- Local mode problems: Verify file paths and execution permissions