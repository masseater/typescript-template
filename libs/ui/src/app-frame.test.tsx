import { RegistryProvider } from "@effect/atom-react";
import {
  RouterContextProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { HomeIcon, SearchIcon, UsersIcon } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";

import { AppFrame } from "./app-frame.tsx";
import { Icon } from "./shared/ui/icon.tsx";

const SPACING_PX = 4;

const paths = ["/", "/home", "/members", "/upgrade"] as const;

describe("app frame", () => {
  const it = test
    .extend("theSharedChrome", () => {
      const rootRoute = createRootRoute();
      const routeTree = rootRoute.addChildren(
        paths.map((path) => createRoute({ getParentRoute: () => rootRoute, path })),
      );
      const adminRouter = createRouter({
        history: createMemoryHistory({ initialEntries: ["/members"] }),
        routeTree,
      });
      const dashboardRouter = createRouter({
        history: createMemoryHistory({ initialEntries: ["/members"] }),
        routeTree,
      });
      const adminMarkup = renderToStaticMarkup(
        <RegistryProvider>
          <RouterContextProvider router={adminRouter}>
            <AppFrame
              collapsedMark="管理"
              defaultCollapsed
              footer={() => <button type="button">アカウント</button>}
              navigationId="app-navigation"
              productName="管理画面"
              sections={[
                {
                  destinations: [
                    {
                      badge: 3,
                      icon: <Icon icon={UsersIcon} />,
                      label: "利用者",
                      to: "/members",
                    },
                  ],
                  label: "運用",
                },
              ]}
              subtitle="運用コンソール"
              title="利用者の一覧"
            >
              <p>本文</p>
            </AppFrame>
          </RouterContextProvider>
        </RegistryProvider>,
      );
      const dashboardMarkup = renderToStaticMarkup(
        <RegistryProvider>
          <RouterContextProvider router={dashboardRouter}>
            <AppFrame
              collapsedMark="社内"
              defaultCollapsed
              footer={() => <button type="button">アカウント</button>}
              headerActions={<a href="https://example.com/">分析</a>}
              navigationId="app-navigation"
              productName="社内ダッシュボード"
              sections={[
                {
                  destinations: [
                    {
                      badge: 3,
                      icon: <Icon icon={UsersIcon} />,
                      label: "利用者",
                      to: "/members",
                    },
                  ],
                  label: "運用",
                },
              ]}
              subtitle="状況と運営"
              title="問い合わせ"
            >
              <p>本文</p>
            </AppFrame>
          </RouterContextProvider>
        </RegistryProvider>,
      );
      const classContaining = (markup: string, token: string): string => {
        const found = new RegExp(`class="([^"]*${token}[^"]*)"`, "u").exec(markup);
        const className = found?.[1];
        if (className === undefined) {
          throw new Error(`missing class ${token}`);
        }
        return className;
      };
      return [adminMarkup].map((admin) => ({
        adminHasInput: admin.includes("<input"),
        adminMark: admin.includes('<span aria-hidden="true">管理</span>'),
        adminProduct: admin.includes('<span class="sr-only">管理画面</span>'),
        adminTitle: admin.includes("利用者の一覧"),
        dashboardActions: dashboardMarkup.includes("分析"),
        dashboardHasInput: dashboardMarkup.includes("<input"),
        dashboardMark: dashboardMarkup.includes('<span aria-hidden="true">社内</span>'),
        dashboardProduct: dashboardMarkup.includes(
          '<span class="sr-only">社内ダッシュボード</span>',
        ),
        headersMatch:
          classContaining(admin, "border-b border-border px-4") ===
          classContaining(dashboardMarkup, "border-b border-border px-4"),
        insetsMatch:
          classContaining(admin, "rounded-lg") === classContaining(dashboardMarkup, "rounded-lg"),
        navigationControls: admin.includes('aria-controls="app-navigation"'),
        shellsMatch:
          classContaining(admin, "min-h-dvh") === classContaining(dashboardMarkup, "min-h-dvh"),
      }));
    })
    .extend("theHeaderIconTargets", () => {
      const rootRoute = createRootRoute();
      const routeTree = rootRoute.addChildren(
        paths.map((path) => createRoute({ getParentRoute: () => rootRoute, path })),
      );
      const router = createRouter({
        history: createMemoryHistory({ initialEntries: ["/members"] }),
        routeTree,
      });
      const markup = renderToStaticMarkup(
        <RegistryProvider>
          <RouterContextProvider router={router}>
            <AppFrame
              collapsedMark="管理"
              footer={() => <button type="button">アカウント</button>}
              navigationId="app-navigation"
              productName="管理画面"
              sections={[
                {
                  destinations: [
                    {
                      badge: 3,
                      icon: <Icon icon={UsersIcon} />,
                      label: "利用者",
                      to: "/members",
                    },
                  ],
                  label: "運用",
                },
              ]}
              subtitle="運用コンソール"
              title="利用者の一覧"
            >
              <p>本文</p>
            </AppFrame>
          </RouterContextProvider>
        </RegistryProvider>,
      );
      const buttonTarget = (
        rendered: string,
        accessibleName: string,
      ): Readonly<{ glyphPx: number; heightPx: number; widthPx: number }> => {
        const matched = new RegExp(
          `<button\\b(?=[^>]*aria-label="${accessibleName}")(?=[^>]*class="([^"]*)")[^>]*>([\\s\\S]*?)</button>`,
          "u",
        ).exec(rendered);
        const className = matched?.[1];
        const inner = matched?.[2];
        if (className === undefined || inner === undefined) {
          throw new Error(`missing button ${accessibleName}`);
        }
        const spacingPx = (subject: string, utility: string): number => {
          const found = new RegExp(String.raw`(?:^|[\s:])${utility}-(\d+(?:\.\d+)?)(?:\s|$)`).exec(
            subject,
          );
          const units = found?.[1];
          if (units === undefined) {
            throw new Error(`missing ${utility} on ${subject}`);
          }
          return Number(units) * SPACING_PX;
        };
        const glyphClass = /<svg\b[^>]*class="([^"]*)"/u.exec(inner)?.[1];
        if (glyphClass === undefined) {
          throw new Error(`missing icon in ${accessibleName}`);
        }
        return {
          glyphPx: spacingPx(glyphClass, "size"),
          heightPx: spacingPx(className, "min-h"),
          widthPx: spacingPx(className, "min-w"),
        };
      };
      return [markup].map((rendered) => ({
        badgeVisible: rendered.includes(">3<"),
        bottomTabs: rendered.includes("fixed inset-x-0 bottom-0"),
        destinationLabel: rendered.includes("利用者"),
        menu: buttonTarget(rendered, "メニュー"),
        sectionLabel: rendered.includes("運用"),
        sidebarToggle: buttonTarget(rendered, "サイドバーを畳む"),
      }));
    })
    .extend("theCompactShell", () => {
      const rootRoute = createRootRoute();
      const routeTree = rootRoute.addChildren(
        paths.map((path) => createRoute({ getParentRoute: () => rootRoute, path })),
      );
      const router = createRouter({
        history: createMemoryHistory({ initialEntries: ["/home"] }),
        routeTree,
      });
      const markup = renderToStaticMarkup(
        <RegistryProvider>
          <RouterContextProvider router={router}>
            <AppFrame
              bottomTabs
              collapsedMark="ユーザー"
              density="compact"
              footer={() => <button type="button">アカウント</button>}
              headerLeading={<span>会員メニュー</span>}
              homeTo="/home"
              navigationId="app-navigation"
              productName="ユーザーアプリ"
              sections={[
                {
                  destinations: [
                    { exact: true, icon: <Icon icon={HomeIcon} />, label: "ホーム", to: "/home" },
                    {
                      icon: <Icon icon={SearchIcon} />,
                      label: "探す",
                      marker: "有料",
                      to: "/upgrade",
                    },
                  ],
                  label: "",
                },
              ]}
              title="ホーム"
            >
              <p>本文</p>
            </AppFrame>
          </RouterContextProvider>
        </RegistryProvider>,
      );
      return [markup].map((rendered) => {
        const tabs = rendered.slice(rendered.indexOf("fixed inset-x-0 bottom-0"));
        return {
          compactWidth: rendered.includes("md:w-32"),
          headerLeading: rendered.includes("会員メニュー"),
          homeHref: rendered.includes('href="/home"'),
          paidMarker: rendered.includes(">有料<"),
          productName: rendered.includes("ユーザーアプリ"),
          railHome: rendered.includes(">ホーム<"),
          tabsHomeAria: tabs.includes('aria-label="ホーム"'),
          tabsHomeVisible: tabs.includes(">ホーム<"),
          tabsPaidAria: tabs.includes('aria-label="探す（有料）"'),
          tabsPaidVisible: tabs.includes(">有料<"),
        };
      });
    })
    .extend("theUnreadableMark", () => {
      const rootRoute = createRootRoute();
      const routeTree = rootRoute.addChildren(
        paths.map((path) => createRoute({ getParentRoute: () => rootRoute, path })),
      );
      const router = createRouter({
        history: createMemoryHistory({ initialEntries: ["/members"] }),
        routeTree,
      });
      try {
        return renderToStaticMarkup(
          <RegistryProvider>
            <RouterContextProvider router={router}>
              <AppFrame
                collapsedMark="管"
                footer={() => <button type="button">アカウント</button>}
                navigationId="app-navigation"
                productName="管理画面"
                sections={[
                  {
                    destinations: [
                      {
                        icon: <Icon icon={UsersIcon} />,
                        label: "利用者",
                        to: "/members",
                      },
                    ],
                    label: "運用",
                  },
                ]}
                title="利用者の一覧"
              >
                <p>本文</p>
              </AppFrame>
            </RouterContextProvider>
          </RegistryProvider>,
        );
      } catch (thrown) {
        return thrown;
      }
    });

  it("uses one header, inset, and sidebar for every product", ({ theSharedChrome }) => {
    expect(theSharedChrome).toStrictEqual([
      {
        adminHasInput: false,
        adminMark: true,
        adminProduct: true,
        adminTitle: true,
        dashboardActions: true,
        dashboardHasInput: false,
        dashboardMark: true,
        dashboardProduct: true,
        headersMatch: true,
        insetsMatch: true,
        navigationControls: true,
        shellsMatch: true,
      },
    ]);
  });

  it("gives the header icon buttons a 24px box around a 20px glyph", ({ theHeaderIconTargets }) => {
    expect(theHeaderIconTargets).toStrictEqual([
      {
        badgeVisible: true,
        bottomTabs: false,
        destinationLabel: true,
        menu: { glyphPx: 20, heightPx: 24, widthPx: 24 },
        sectionLabel: true,
        sidebarToggle: { glyphPx: 20, heightPx: 24, widthPx: 24 },
      },
    ]);
  });

  it("keeps compact labels on the rail and icons in the bottom tabs", ({ theCompactShell }) => {
    expect(theCompactShell).toStrictEqual([
      {
        compactWidth: true,
        headerLeading: true,
        homeHref: true,
        paidMarker: true,
        productName: true,
        railHome: true,
        tabsHomeAria: true,
        tabsHomeVisible: false,
        tabsPaidAria: true,
        tabsPaidVisible: true,
      },
    ]);
  });

  it("refuses a one-character collapsed mark", ({ theUnreadableMark }) => {
    expect(theUnreadableMark).toStrictEqual(new Error("collapsed mark must be a readable word"));
  });
});
