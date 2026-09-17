import { Effect, Schema } from "effect";

class LocalCommandFailure extends Schema.TaggedError<LocalCommandFailure>()("LocalCommandFailure", {
  reason: Schema.Literals([
    "command_unsupported",
    "app_invalid",
    "file_io_failed",
    "process_failed",
    "credentials_permissions_invalid",
    "credentials_invalid",
    "configuration_exists",
    "configuration_differs",
    "browser_socket_directory_invalid",
    "browser_start_failed",
    "browser_authentication_failed",
    "browser_command_required",
  ]),
}) {}

function failure(reason: LocalCommandFailure["reason"]): LocalCommandFailure {
  return new LocalCommandFailure({ reason });
}

function fileIo<Value>(operation: () => Promise<Value>): Effect.Effect<Value, LocalCommandFailure> {
  return Effect.tryPromise({ catch: () => failure("file_io_failed"), try: operation });
}

export { LocalCommandFailure, failure, fileIo };
