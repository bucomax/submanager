// Inicialização do Sentry no browser, carregada a cada page load.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { sentrySharedOptions } from "@/lib/observability/sentry-shared-options";

Sentry.init(sentrySharedOptions);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
