type ListedSetting = {
  readonly label: string;
  readonly to:
    | "/settings/agreements"
    | "/settings/ai"
    | "/settings/email"
    | "/settings/interview"
    | "/settings/leave"
    | "/settings/notifications"
    | "/settings/plan"
    | "/settings/profile"
    | "/settings/recovery"
    | "/settings/security"
    | "/settings/visibility";
};

const settingsItems = [
  { label: "プロフィール", to: "/settings/profile" },
  { label: "公開範囲", to: "/settings/visibility" },
  { label: "メールアドレス", to: "/settings/email" },
  { label: "通知", to: "/settings/notifications" },
  { label: "セキュリティ", to: "/settings/security" },
  { label: "AI インタビュー", to: "/settings/interview" },
  { label: "AI と API", to: "/settings/ai" },
  { label: "プランと解約", to: "/settings/plan" },
  { label: "規約への同意", to: "/settings/agreements" },
  { label: "データの復旧", to: "/settings/recovery" },
  { label: "退会", to: "/settings/leave" },
] as const satisfies readonly ListedSetting[];

export { settingsItems };
