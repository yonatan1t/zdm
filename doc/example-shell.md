help
Please press the <Tab> button to see all available commands.
You can also use the <Tab> button to prompt or auto-complete all commands or its subcommands.
You can try to call commands with <-h> or <--help> parameter for more information.

Shell supports following meta-keys:
  Ctrl + (a key from: abcdefklnptuw)
  Alt  + (a key from: bf)
Please refer to shell documentation for more details.

Available commands:
  bypass              : Bypass shell
  clear               : Clear screen.
  date                : Date commands
  demo                : Demo commands
  device              : Device commands
  devmem              : Read/write physical memory
                        Usage:
                        Read memory at address with optional width:
                        devmem <address> [<width>]
                        Write memory at address with mandatory width and value:
                        devmem <address> <width> <value>
  dynamic             : Demonstrate dynamic command usage.
  help                : Prints the help message.
  history             : Command history.
  kernel              : Kernel commands
  log                 : Commands for controlling logger
  log_test            : Log test
  rem                 : Ignore lines beginning with 'rem '
  resize              : Console gets terminal screen size or assumes default in
                        case the readout fails. It must be executed after each
                        terminal width change to ensure correct text display.
  retval              : Print return value of most recent command
  section_cmd         : Demo command using section for subcommand registration
  shell               : Useful, not Unix-like shell commands.
  shell_uart_release  : Uninitialize shell instance and release uart, start
                        loopback on uart. Shell instance is reinitialized when
                        'x' is pressed
  stats               : Stats commands
  version             : Show kernel version
uart:~$ bypass --help
bypass - Bypass shell
uart:~$ clear --help
clear - Clear screen.
uart:~$ date --help
date - Date commands
Subcommands:
  set  : [Y-m-d] <H:M:S>
  get  : [none]
uart:~$ demo --help
demo - Demo commands
Subcommands:
  dictionary  : Dictionary commands
  hexdump     : Hexdump params command.
  params      : Print params command.
  ping        : Ping command.
  board       : Show board name command.
uart:~$ device --help
device - Device commands
Subcommands:
  list  : List configured devices, with an optional filter
          Usage: list [<device filter>]
  init  : Manually initialize a device
uart:~$ devmem --help
devmem - Read/write physical memory
         Usage:
         Read memory at address with optional width:
         devmem <address> [<width>]
         Write memory at address with mandatory width and value:
         devmem <address> <width> <value>
Subcommands:
  dump  : Usage:
          devmem dump -a <address> -s <size> [-w <width>]

  load  : Usage:
          devmem load [options] [address]
          Options:
          -e    little-endian parse
uart:~$ dynamic --help
dynamic - Demonstrate dynamic command usage.
Subcommands:
  add      : Add a new dynamic command.
             Example usage: [ dynamic add test ] will add a dynamic command
             'test'.
             In this example, command name length is limited to 32 chars. You
             can add up to 20 commands. Commands are automatically sorted to
             ensure correct shell completion.
  execute  : Execute a command.
  remove   : Remove a command.
  show     : Show all added dynamic commands.
uart:~$ help --help
help - Prints the help message.
uart:~$ history --help
history - Command history.
uart:~$ kernel --help
kernel - Kernel commands
Subcommands:
  cycles     : Kernel cycles.
  log_level  : <module name> <severity (0-4)>
  sleep      : ms
  thread     : Kernel threads.
  uptime     : Kernel uptime. Can be called with the -p or --pretty options
  version    : Kernel version.
uart:~$ log --help
log - Commands for controlling logger
Subcommands:
  backend        : Logger backends commands.
  disable        : 'log disable <module_0> .. <module_n>' disables logs in
                   specified modules (all if no modules specified).
  enable         : 'log enable <level> <module_0> ...  <module_n>' enables logs
                   up to given level in specified modules (all if no modules
                   specified).
  go             : Resume logging
  halt           : Halt logging
  list_backends  : Lists logger backends.
  status         : Logger status
uart:~$ log_test --help
log_test - Log test
Subcommands:
  start  : Start log test
  stop   : Stop log test.
uart:~$ rem --help
rem - Ignore lines beginning with 'rem '
uart:~$ resize --help
resize - Console gets terminal screen size or assumes default in case the
         readout fails. It must be executed after each terminal width change to
         ensure correct text display.
Subcommands:
  default  : Assume 80 chars screen width and send this setting to the terminal.
uart:~$ retval --help
retval - Print return value of most recent command
uart:~$ section_cmd --help
section_cmd - Demo command using section for subcommand registration
Subcommands:
  cmd1  : help for cmd1
  cmd2  : help for cmd2
uart:~$ shell --help
shell - Useful, not Unix-like shell commands.
Subcommands:
  backends        : List active shell backends.

  backspace_mode  : Toggle backspace key mode.
                    Some terminals are not sending separate escape code for
                    backspace and delete button. This command forces shell to
                    interpret delete key as backspace.
  colors          : Toggle colored syntax.
  vt100           : Toggle vt100 commands.
  prompt          : Toggle prompt.
  echo            : Toggle shell echo.
  stats           : Shell statistics.
uart:~$ shell_uart_release --help
shell_uart_release - Uninitialize shell instance and release uart, start
                     loopback on uart. Shell instance is reinitialized when 'x'
                     is pressed
uart:~$ stats --help
stats - Stats commands
Subcommands:
  list  : List stats
uart:~$ version --help
version - Show kernel version
uart:~$ 
uart:~$ 