import { Schema } from "effect";

class LocalCommandFailure extends Schema.TaggedError<LocalCommandFailure>()("LocalCommandFailure", {
  reason: Schema.Literals([
    "command_unsupported",
    "origin_mode_invalid",
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
    "ci_runner_root_required",
    "ci_runner_service_invalid",
    "operator_credentials_stale",
    "operator_provision_failed",
  ]),
}) {}

function failure(reason: LocalCommandFailure["reason"]): LocalCommandFailure {
  return new LocalCommandFailure({ reason });
}

export { LocalCommandFailure, failure };
