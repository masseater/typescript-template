import { inviteRoute } from "@repo/auth-ui";
import { getRouteApi } from "@tanstack/react-router";

const InviteRoute = inviteRoute(getRouteApi("/invite/$token"));

export { InviteRoute };
