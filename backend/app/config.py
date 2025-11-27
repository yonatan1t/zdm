"""Configuration management for Zephyr Device Manager.

This module provides centralized configuration using Pydantic Settings.
All configuration can be overridden via environment variables with ZDM_ prefix.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


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


# Global settings instance
_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """Get the global settings instance.
    
    Returns:
        Settings: The application settings instance.
    """
    global _settings
    if _settings is None:
        _settings = Settings()
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
