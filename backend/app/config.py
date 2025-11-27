"""Configuration management for Zephyr Device Manager.

This module provides centralized configuration using Pydantic Settings.
All configuration can be overridden via environment variables with ZDM_ prefix.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator, ValidationError
from typing import Optional
import logging


class Settings(BaseSettings):
    """Application settings with environment variable support.
    
    All settings can be overridden via environment variables with ZDM_ prefix.
    For example, ZDM_HOST=127.0.0.1 will override the host setting.
    """
    
    # Server configuration
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    reload: bool = False
    
    # Serial configuration
    default_baudrate: int = 115200
    serial_timeout: float = 0.1
    max_reconnect_attempts: int = 3
    reconnect_delay: float = 1.0
    
    # WebSocket configuration
    ws_heartbeat_interval: int = 30
    ws_message_queue_size: int = 1000
    ws_max_reconnect_attempts: int = 10
    ws_reconnect_interval: int = 1000
    ws_max_reconnect_interval: int = 30000
    ws_reconnect_decay: float = 1.5
    
    # Logging configuration
    log_level: str = "INFO"
    log_format: str = "json"
    log_file: str = "logs/zdm.log"
    log_max_bytes: int = 10485760  # 10MB
    log_backup_count: int = 5
    log_serial_data: bool = False
    
    # Security configuration
    enable_auth: bool = False
    api_rate_limit: str = "100/minute"
    allowed_origins: list[str] = ["*"]
    
    # Performance configuration
    buffer_size: int = 8192
    max_buffer_size: int = 1048576  # 1MB
    terminal_max_lines: int = 10000
    
    # Feature flags
    enable_command_discovery: bool = True
    enable_metrics: bool = False
    
    # Database configuration (for future use)
    database_url: Optional[str] = None
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="ZDM_",
        case_sensitive=False,
        extra="ignore"
    )
    
    @field_validator('port')
    @classmethod
    def validate_port(cls, v: int) -> int:
        """Validate port number is in valid range."""
        if not 1 <= v <= 65535:
            raise ValueError(f"Port must be between 1 and 65535, got {v}")
        return v
    
    @field_validator('default_baudrate')
    @classmethod
    def validate_baudrate(cls, v: int) -> int:
        """Validate baud rate is in acceptable range."""
        valid_baudrates = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600]
        if v not in valid_baudrates:
            raise ValueError(f"Baud rate must be one of {valid_baudrates}, got {v}")
        return v
    
    @field_validator('log_level')
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        """Validate log level is valid."""
        valid_levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
        v_upper = v.upper()
        if v_upper not in valid_levels:
            raise ValueError(f"Log level must be one of {valid_levels}, got {v}")
        return v_upper
    
    @field_validator('log_format')
    @classmethod
    def validate_log_format(cls, v: str) -> str:
        """Validate log format is valid."""
        valid_formats = ['json', 'standard']
        v_lower = v.lower()
        if v_lower not in valid_formats:
            raise ValueError(f"Log format must be one of {valid_formats}, got {v}")
        return v_lower
    
    @field_validator('serial_timeout', 'reconnect_delay')
    @classmethod
    def validate_positive_float(cls, v: float) -> float:
        """Validate float values are positive."""
        if v <= 0:
            raise ValueError(f"Value must be positive, got {v}")
        return v
    
    @field_validator('max_reconnect_attempts', 'ws_max_reconnect_attempts', 
                     'ws_heartbeat_interval', 'ws_message_queue_size',
                     'log_max_bytes', 'log_backup_count', 'buffer_size',
                     'max_buffer_size', 'terminal_max_lines')
    @classmethod
    def validate_positive_int(cls, v: int) -> int:
        """Validate integer values are positive."""
        if v <= 0:
            raise ValueError(f"Value must be positive, got {v}")
        return v


# Global settings instance
_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """Get the global settings instance.
    
    Returns:
        Settings: The application settings instance.
        
    Raises:
        ValidationError: If configuration validation fails.
    """
    global _settings
    if _settings is None:
        try:
            _settings = Settings()
            # Log successful configuration load (will be properly logged once logging is set up)
            print(f"Configuration loaded successfully (log_level={_settings.log_level})")
        except ValidationError as e:
            print(f"Configuration validation failed: {e}")
            raise
    return _settings


def reload_settings() -> Settings:
    """Reload settings from environment.
    
    Useful for testing or when configuration changes.
    
    Returns:
        Settings: The newly loaded settings instance.
    """
    global _settings
    _settings = Settings()
    return _settings
