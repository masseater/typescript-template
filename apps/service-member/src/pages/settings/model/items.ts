type ListedSetting = {
  readonly label: string;
  readonly to:
    | "/settings/ai"
    | "/settings/email"
    | "/settings/interview"
    | "/settings/leave"
    | "/settings/notifications"
    | "/settings/plan"
    | "/settings/profile"
    | "/settings/security"
    | "/support";
};

const settingsItems = [
  { label: "お問い合わせ", to: "/support" },
  { label: "プロフィール", to: "/settings/profile" },
  { label: "メールアドレス", to: "/settings/email" },
  { label: "通知", to: "/settings/notifications" },
  { label: "セキュリティ", to: "/settings/security" },
  { label: "AI インタビュー", to: "/settings/interview" },
  { label: "AI と API", to: "/settings/ai" },
  { label: "プランと解約", to: "/settings/plan" },
  { label: "退会", to: "/settings/leave" },
] as const satisfies readonly ListedSetting[];

export { settingsItems };
