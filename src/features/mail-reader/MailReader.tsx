import { useEffect, useState, type FormEvent } from "react";
import {
  Archive,
  Bell,
  BellRing,
  ChevronDown,
  Circle,
  CircleHelp,
  Clock3,
  FileStack,
  Flag,
  Folder,
  Forward,
  Inbox,
  Mail,
  Menu,
  MessageSquareMore,
  Paperclip,
  Plus,
  Reply,
  ReplyAll,
  Search,
  Send,
  Settings,
  Shield,
  Sparkles,
  Star,
  Trash2,
  Users,
  RotateCw,
  CalendarDays,
  LogOut,
  MoreHorizontal,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getVisibleMessages,
  mailFolders,
  sampleMessages,
  type MailFolderId,
  type MailMessage,
} from "./mailData";
import {
  archiveMailMessage,
  getMailboxSession,
  getMailSessionToken,
  fetchMailMessages,
  isMailApiConfigured,
  loginToMailbox,
  logoutMailbox,
  markMailMessageFlagged,
  markMailMessageSeen,
  sendMailMessage,
  trashMailMessage,
} from "@/lib/mailApi";
import { cn } from "@/lib/utils";

const folderIcons = {
  inbox: Inbox,
  starred: Star,
  important: BellRing,
  archive: Archive,
};

const emptyCopy: Record<MailFolderId, { title: string; detail: string }> = {
  inbox: {
    title: "Inbox is clear",
    detail: "No matching mail landed in the inbox for this filter.",
  },
  starred: {
    title: "Nothing starred yet",
    detail: "Mark important threads with a star so they stay easy to revisit.",
  },
  important: {
    title: "No urgent mail",
    detail: "Important messages will appear here when a thread needs attention.",
  },
  archive: {
    title: "Archive is empty",
    detail: "Archived conversations will collect here once you start triaging mail.",
  },
};

const customFolders = [
  "App",
  "Deanna",
  "Done",
  "Farmtek",
  "Fiber",
  "Loadrite",
  "Menards",
  "Modern Retail",
  "Rapid POS",
  "Shopify",
  "Software",
];

const topNavItems = [
  { label: "Mail", icon: Mail },
  { label: "Calendar", icon: CalendarDays },
  { label: "Contacts", icon: Users },
  { label: "Files", icon: FileStack },
];
const actionItems = [
  { label: "Summarize", icon: Sparkles },
  { label: "Trash", icon: Trash2 },
  { label: "Archive", icon: Archive },
  { label: "Mark important", icon: Shield },
  { label: "Reply", icon: Reply },
  { label: "Reply all", icon: ReplyAll },
  { label: "Forward", icon: Forward },
  { label: "Star", icon: Flag },
  { label: "Move to archive", icon: Folder },
  { label: "More actions", icon: MoreHorizontal },
];
const utilityIcons = [CalendarDays, MessageSquareMore];
const headerUtilityItems = [
  { label: "Notifications", icon: Bell },
  { label: "Assistant", icon: Sparkles, iconClassName: "text-[#d06cff]" },
  { label: "Refresh", icon: RotateCw },
  { label: "Help", icon: CircleHelp },
  { label: "Settings", icon: Settings },
  { label: "Sign out", icon: LogOut },
];
const systemFolders = [
  { id: "inbox" as const, label: "Inbox", count: 2 },
  { id: "drafts" as const, label: "Drafts" },
  { id: "sent" as const, label: "Sent" },
  { id: "spam" as const, label: "Spam" },
  { id: "trash" as const, label: "Trash", count: 1 },
];

type SystemFolderId = (typeof systemFolders)[number]["id"];
type MailboxViewId = MailFolderId | SystemFolderId | `custom:${string}`;
type PanelView = "compose" | "settings" | "help" | "module" | "status" | null;

const systemFolderIcons = {
  inbox: Inbox,
  drafts: FileStack,
  sent: Send,
  spam: Shield,
  trash: Trash2,
};

const panelTitles: Record<Exclude<PanelView, null>, string> = {
  compose: "New email",
  settings: "Settings",
  help: "Help",
  module: "Coming soon",
  status: "Mail action",
};

const MailReader = () => {
  const [messages, setMessages] = useState<MailMessage[]>(sampleMessages);
  const [selectedView, setSelectedView] = useState<MailboxViewId>("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState(sampleMessages[0]?.id ?? "");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelView>(null);
  const [panelMessage, setPanelMessage] = useState("Ready.");
  const [lastUpdated, setLastUpdated] = useState("Updated just now");
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showCustomFolders, setShowCustomFolders] = useState(true);
  const [mailApiStatus, setMailApiStatus] = useState(
    isMailApiConfigured ? "Live mailbox ready to sync." : "Demo mode. Add VITE_MAIL_API_URL to sync live mail.",
  );
  const [draftTo, setDraftTo] = useState("");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftText, setDraftText] = useState("");
  const [sessionToken, setSessionToken] = useState(() => getMailSessionToken());
  const [mailboxAccount, setMailboxAccount] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isMessageOpen, setIsMessageOpen] = useState(false);

  const selectedFolder = isMailFolderId(selectedView) ? selectedView : "inbox";

  const visibleMessages = getVisibleMessagesForView(messages, selectedView, {
    query: searchQuery,
    unreadOnly: showUnreadOnly,
  });

  const selectedMessage =
    visibleMessages.find((message) => message.id === selectedMessageId) ?? visibleMessages[0] ?? null;

  useEffect(() => {
    if (!selectedMessage) {
      setSelectedMessageId("");
      return;
    }

    if (selectedMessage.id !== selectedMessageId) {
      setSelectedMessageId(selectedMessage.id);
    }
  }, [selectedMessage, selectedMessageId]);

  useEffect(() => {
    const navMediaQuery = window.matchMedia("(min-width: 768px)");
    const sidebarMediaQuery = window.matchMedia("(min-width: 1024px)");
    const syncNavState = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) {
        setIsMobileMenuOpen(false);
      }
    };
    const syncSidebarState = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) {
        setIsFolderMenuOpen(false);
      }
    };

    syncNavState(navMediaQuery);
    syncSidebarState(sidebarMediaQuery);

    const handleNavChange = (event: MediaQueryListEvent) => syncNavState(event);
    const handleSidebarChange = (event: MediaQueryListEvent) => syncSidebarState(event);
    navMediaQuery.addEventListener("change", handleNavChange);
    sidebarMediaQuery.addEventListener("change", handleSidebarChange);

    return () => {
      navMediaQuery.removeEventListener("change", handleNavChange);
      sidebarMediaQuery.removeEventListener("change", handleSidebarChange);
    };
  }, []);

  useEffect(() => {
    if (!isMailApiConfigured || !sessionToken || selectedView.startsWith("custom:")) return;

    void loadLiveMessages(selectedView);
  }, [selectedView, sessionToken]);

  useEffect(() => {
    if (!isMailApiConfigured || !sessionToken) return;

    void getMailboxSession()
      .then((session) => {
        setMailboxAccount(session.email);
        setMailApiStatus(`Signed in as ${session.email}`);
      })
      .catch(() => {
        setSessionToken("");
        setMailboxAccount("");
        setMailApiStatus("Please sign in to sync mail.");
      });
  }, [sessionToken]);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const closeFolderMenu = () => setIsFolderMenuOpen(false);

  const loadLiveMessages = async (view: MailboxViewId) => {
    try {
      setMailApiStatus("Syncing mailbox...");
      const liveMessages = await fetchMailMessages(getApiFolder(view));
      setMessages(liveMessages);
      setLastUpdated(`Updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
      setMailApiStatus("Live mailbox synced.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sync mailbox.";
      if (message.toLowerCase().includes("login required")) {
        setSessionToken("");
      }
      setMailApiStatus(message);
      showPanel("status", "Could not reach the mail API. Keeping the current messages on screen.");
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoggingIn(true);
    setLoginError("");

    try {
      const session = await loginToMailbox({ email: loginEmail, password: loginPassword });
      setSessionToken(session.token);
      setMailboxAccount(session.email);
      setLoginPassword("");
      setMailApiStatus(`Signed in as ${session.email}`);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Mailbox login failed.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logoutMailbox();
    setSessionToken("");
    setMailboxAccount("");
    setMessages(sampleMessages);
    setMailApiStatus("Signed out.");
  };

  const showPanel = (view: Exclude<PanelView, null>, message: string) => {
    setPanelMessage(message);
    setActivePanel(view);
  };

  const chooseView = (view: MailboxViewId) => {
    setSelectedView(view);
    setSearchQuery("");
    setShowUnreadOnly(false);
    setShowMoreActions(false);
    setActivePanel(null);
    setIsMessageOpen(false);
    closeMobileMenu();
    closeFolderMenu();
  };

  const updateSelectedMessage = (updates: Partial<MailMessage>, status: string) => {
    if (!selectedMessage) {
      showPanel("status", "Choose a message first.");
      return;
    }

    setMessages((current) =>
      current.map((message) => (message.id === selectedMessage.id ? { ...message, ...updates } : message)),
    );
    showPanel("status", status);
  };

  const handleRefresh = async () => {
    if (isMailApiConfigured) {
      await loadLiveMessages(selectedView);
      return;
    }

    setMessages(sampleMessages);
    setSearchQuery("");
    setShowUnreadOnly(false);
    setLastUpdated(`Updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
    showPanel("status", "Mailbox refreshed from the demo message set.");
  };

  const handleDelete = async () => {
    if (!selectedMessage) {
      showPanel("status", "Choose a message first.");
      return;
    }

    if (isMailApiConfigured) {
      try {
        await trashMailMessage(selectedMessage.id);
      } catch (error) {
        showPanel("status", error instanceof Error ? error.message : "Unable to move message to trash.");
        return;
      }
    }

    setMessages((current) => current.filter((message) => message.id !== selectedMessage.id));
    setIsMessageOpen(false);
    showPanel("status", `"${selectedMessage.subject}" moved to trash.`);
  };

  const openMessage = (message: MailMessage) => {
    setSelectedMessageId(message.id);
    setIsMessageOpen(true);

    if (isMailApiConfigured && message.unread) {
      void markMailMessageSeen(message.id, true).catch((error) =>
        showPanel("status", error instanceof Error ? error.message : "Unable to mark read."),
      );
    }

    setMessages((current) =>
      current.map((item) => (item.id === message.id ? { ...item, unread: false } : item)),
    );
  };

  const handleAction = async (label: string) => {
    setShowMoreActions(false);

    if (label === "Summarize") {
      showPanel(
        "status",
        selectedMessage
          ? `${selectedMessage.from}: ${selectedMessage.preview}`
          : "Choose a message and I will summarize it here.",
      );
      return;
    }

    if (label === "Trash") {
      await handleDelete();
      return;
    }

    if (label === "Archive" || label === "Move to archive") {
      if (selectedMessage && isMailApiConfigured) {
        try {
          await archiveMailMessage(selectedMessage.id);
        } catch (error) {
          showPanel("status", error instanceof Error ? error.message : "Unable to archive message.");
          return;
        }
      }

      updateSelectedMessage({ folder: "archive", unread: false }, "Message archived.");
      return;
    }

    if (label === "Mark important") {
      updateSelectedMessage({ important: !selectedMessage?.important }, "Important flag toggled.");
      return;
    }

    if (label === "Star") {
      if (selectedMessage && isMailApiConfigured) {
        try {
          await markMailMessageFlagged(selectedMessage.id, !selectedMessage.starred);
        } catch (error) {
          showPanel("status", error instanceof Error ? error.message : "Unable to update star.");
          return;
        }
      }

      updateSelectedMessage({ starred: !selectedMessage?.starred }, "Starred status toggled.");
      return;
    }

    if (label === "Reply" || label === "Reply all" || label === "Forward") {
      setDraftTo(label === "Forward" ? "" : (selectedMessage?.fromAddress ?? ""));
      setDraftSubject(selectedMessage ? `${label === "Forward" ? "Fwd" : "Re"}: ${selectedMessage.subject}` : "");
      setDraftText("");
      showPanel(
        "compose",
        selectedMessage ? `${label} draft for "${selectedMessage.subject}"` : "Choose a message before replying.",
      );
      return;
    }

    if (label === "More actions") {
      setShowMoreActions((current) => !current);
    }
  };

  const handleHeaderUtility = async (label: string) => {
    if (label === "Refresh") {
      await handleRefresh();
      return;
    }

    if (label === "Settings") {
      showPanel("settings", "Mailbox identity, sync, and notification settings will live here.");
      return;
    }

    if (label === "Help") {
      showPanel("help", "Use folders on the left, search above, and the toolbar to act on the selected message.");
      return;
    }

    if (label === "Sign out") {
      void handleLogout();
      return;
    }

    showPanel("status", `${label} opened.`);
  };

  const handleSendDraft = async () => {
    if (!isMailApiConfigured) {
      showPanel("status", "Draft saved locally for this demo. Configure the mail API to send real mail.");
      return;
    }

    try {
      await sendMailMessage({ to: draftTo, subject: draftSubject, text: draftText });
      setDraftTo("");
      setDraftSubject("");
      setDraftText("");
      showPanel("status", "Email sent.");
    } catch (error) {
      showPanel("status", error instanceof Error ? error.message : "Unable to send email.");
    }
  };

  if (isMailApiConfigured && !sessionToken) {
    return (
      <LoginScreen
        email={loginEmail}
        password={loginPassword}
        error={loginError}
        isLoggingIn={isLoggingIn}
        onEmailChange={setLoginEmail}
        onPasswordChange={setLoginPassword}
        onSubmit={handleLogin}
      />
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#171717] text-[#d9d9d9]">
      <div className="flex min-h-screen w-full min-w-0 flex-col">
        <header
          className="sticky top-0 z-30 border-b border-white/5 bg-[#101010]/95 px-4 text-sm backdrop-blur"
          style={{ paddingTop: "var(--app-safe-top)" }}
        >
          <div className="relative pb-3">
            <div className="flex min-h-14 items-center gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3 md:min-w-[180px] md:flex-none md:gap-4">
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen((current) => !current)}
                  aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                  aria-expanded={isMobileMenuOpen}
                  className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 text-[#b0b0b0] transition hover:border-white/20 hover:bg-white/5 hover:text-white md:hidden"
                >
                  {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>

                <div className="truncate text-[20px] font-semibold tracking-[0.28em] text-white sm:text-[22px]">IONOS</div>

                <div className="hidden items-center gap-2 md:flex">
                  {topNavItems.map(({ label, icon: Icon }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() =>
                        label === "Mail"
                          ? chooseView("inbox")
                          : showPanel("module", `${label} is ready for the next screen when we add it.`)
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-md text-[#8f8f8f] transition hover:bg-white/5 hover:text-white"
                      aria-label={label}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="hidden md:mx-auto md:block md:w-full md:max-w-xl">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b8b8b]" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search email"
                    className="h-10 border-white/5 bg-[#252525] pl-12 text-[#f0f0f0] placeholder:text-[#8a8a8a] focus-visible:ring-[#444]"
                  />
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#787878]" />
                </div>
              </div>

              <div className="ml-auto flex items-center gap-4 text-[#9a9a9a]">
                <div className="hidden items-center gap-4 md:flex">
                  {headerUtilityItems.map(({ label, icon: Icon, iconClassName }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => handleHeaderUtility(label)}
                      className="transition hover:text-white"
                      aria-label={label}
                    >
                      <Icon className={cn("h-4 w-4", iconClassName)} />
                    </button>
                  ))}
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2d2d2d] text-xs font-semibold text-[#c8c8c8]">
                  {getInitials(mailboxAccount || "Mail Sync")}
                </div>
              </div>
            </div>

            <div className="pt-2 md:hidden">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b8b8b]" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search email"
                  className="h-10 border-white/5 bg-[#252525] pl-12 text-[#f0f0f0] placeholder:text-[#8a8a8a] focus-visible:ring-[#444]"
                />
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#787878]" />
              </div>
            </div>

            {isMobileMenuOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Close navigation menu"
                  onClick={closeMobileMenu}
                  className="absolute inset-x-0 top-full h-screen bg-black/30 md:hidden"
                />
                <div className="absolute inset-x-0 top-full z-10 mt-3 rounded-2xl border border-white/10 bg-[#181818] p-3 shadow-[0_18px_40px_rgba(0,0,0,0.45)] md:hidden">
                  <div className="grid grid-cols-2 gap-2">
                    {topNavItems.map(({ label, icon: Icon }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() =>
                          label === "Mail"
                            ? chooseView("inbox")
                            : showPanel("module", `${label} is ready for the next screen when we add it.`)
                        }
                        className="flex items-center gap-3 rounded-xl border border-white/8 bg-[#212121] px-4 py-3 text-left text-sm text-[#d6d6d6] transition hover:border-white/15 hover:bg-[#2a2a2a]"
                      >
                        <Icon className="h-4 w-4 text-[#d17a46]" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/8 pt-3">
                    {headerUtilityItems.map(({ label, icon: Icon, iconClassName }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          handleHeaderUtility(label);
                          closeMobileMenu();
                        }}
                        className="flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-[#a9a9a9] transition hover:bg-[#232323] hover:text-white"
                      >
                        <Icon className={cn("h-4 w-4", iconClassName)} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </header>

        <div className="grid min-w-0 flex-1 overflow-hidden lg:grid-cols-[286px_minmax(0,1fr)_52px]">
          {isFolderMenuOpen ? (
            <button
              type="button"
              aria-label="Close folders menu"
              onClick={closeFolderMenu}
              className="fixed inset-0 z-30 bg-black/45 lg:hidden"
            />
          ) : null}

          <aside
            className={cn(
              "fixed inset-y-0 left-0 z-40 flex h-dvh w-[286px] flex-col border-r border-white/5 bg-[#111111] px-3 py-4 shadow-2xl transition-transform duration-200 lg:static lg:z-auto lg:h-full lg:w-auto lg:translate-x-0 lg:shadow-none",
              isFolderMenuOpen ? "translate-x-0" : "-translate-x-full",
            )}
            style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}
          >
            <div className="mb-4 flex items-center justify-between lg:hidden">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[#777]">Mailbox</p>
                <p className="mt-1 font-semibold text-white">Folders</p>
              </div>
              <button
                type="button"
                onClick={closeFolderMenu}
                className="rounded-md border border-white/10 p-2 text-[#b0b0b0] transition hover:bg-white/5 hover:text-white"
                aria-label="Close folders menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setDraftTo("");
                setDraftSubject("");
                setDraftText("");
                showPanel("compose", "New draft ready. Sending will connect once the mailbox backend is added.");
                closeFolderMenu();
              }}
              className="mb-5 flex h-10 items-center justify-center rounded bg-[#b04e12] text-sm font-semibold text-white transition hover:bg-[#c85a15]"
            >
              New email
              <ChevronDown className="ml-2 h-4 w-4" />
            </button>

            <div className="mb-3 flex items-center gap-2 px-2 text-sm font-medium text-[#bebebe]">
              <ChevronDown className="h-4 w-4 text-[#767676]" />
              greenhillswi.com
            </div>

            <div className="space-y-1">
              {systemFolders.map((folder) => {
                const Icon = systemFolderIcons[folder.id];

                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => chooseView(folder.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm transition",
                      selectedView === folder.id
                        ? "bg-[#343434] text-white"
                        : "text-[#9a9a9a] hover:bg-[#1f1f1f] hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4 text-[#d17a46]" />
                    <span className="flex-1">{folder.label}</span>
                    <span className="text-xs text-[#c7c7c7]">{getViewCount(messages, folder.id)}</span>
                    {selectedView === folder.id ? <MoreHorizontal className="h-4 w-4 text-[#9d9d9d]" /> : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex items-center justify-between px-2 text-sm text-[#9d9d9d]">
              <button
                type="button"
                onClick={() => setShowCustomFolders((current) => !current)}
                className="flex items-center gap-2 transition hover:text-white"
              >
                <ChevronDown className={cn("h-4 w-4 text-[#767676] transition", !showCustomFolders && "-rotate-90")} />
                My folders
              </button>
              <button
                type="button"
                onClick={() => showPanel("status", "Folder creation is ready for a backend save step.")}
                className="rounded p-1 transition hover:bg-[#1f1f1f] hover:text-white"
                aria-label="Add folder"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <ScrollArea className="mt-2 flex-1 pr-2">
              <div className="space-y-1 pb-4">
                {mailFolders
                  .filter((folder) => folder.id !== "inbox")
                  .map((folder) => {
                    const Icon = folderIcons[folder.id];

                    return (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => chooseView(folder.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm transition",
                          selectedView === folder.id
                            ? "bg-[#2b2b2b] text-white"
                            : "text-[#8f8f8f] hover:bg-[#1b1b1b] hover:text-white",
                        )}
                      >
                        <Icon className="h-4 w-4 text-[#d17a46]" />
                        <span className="flex-1">{folder.label}</span>
                        <span className="text-xs text-[#b0b0b0]">{getViewCount(messages, folder.id)}</span>
                      </button>
                    );
                  })}

                {showCustomFolders
                  ? customFolders.map((folder) => (
                      <button
                        key={folder}
                        type="button"
                        onClick={() => chooseView(`custom:${folder}`)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm transition",
                          selectedView === `custom:${folder}`
                            ? "bg-[#2b2b2b] text-white"
                            : "text-[#8f8f8f] hover:bg-[#1b1b1b] hover:text-white",
                        )}
                      >
                        <Folder className="h-4 w-4 text-[#d17a46]" />
                        <span>{folder}</span>
                      </button>
                    ))
                  : null}
              </div>
            </ScrollArea>

            <div className="mt-auto flex items-center justify-between pt-4 text-[#8b8b8b]">
              <button
                type="button"
                onClick={() => showPanel("module", "Files will open here when attachments are connected.")}
                className="rounded p-1 transition hover:bg-[#1f1f1f] hover:text-white"
              >
                <FileStack className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleHeaderUtility("Help")}
                className="rounded p-1 transition hover:bg-[#1f1f1f] hover:text-white"
              >
                <CircleHelp className="h-4 w-4" />
              </button>
            </div>

            <div className="pt-4 text-xs text-[#a6a6a6]">
              <div>Mail quota</div>
              <div className="mt-1 font-semibold text-[#dbdbdb]">77 MB of 2 GB used</div>
              <div className="mt-2 h-2 rounded-full bg-[#3a3a3a]">
                <div className="h-2 w-[9%] rounded-full bg-[#df6517]" />
              </div>
            </div>
          </aside>

          <main className="flex min-w-0 flex-col bg-[#1c1c1c]">
            <div className="relative flex items-center gap-2 overflow-x-auto px-3 py-3 text-[#919191] sm:px-6 sm:py-4">
              <button
                type="button"
                onClick={() => setIsFolderMenuOpen(true)}
                className="mr-2 flex shrink-0 items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm font-medium text-[#d0d0d0] transition hover:border-white/20 hover:bg-[#2a2a2a] hover:text-white lg:hidden"
                aria-label="Open folders menu"
                aria-expanded={isFolderMenuOpen}
              >
                <Menu className="h-4 w-4" />
                Folders
              </button>
              {actionItems.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleAction(label)}
                  className={cn(
                    "shrink-0 rounded p-2 transition hover:bg-[#2a2a2a] hover:text-white",
                    label === "More actions" && showMoreActions && "bg-[#2a2a2a] text-white",
                  )}
                  aria-label={label}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
              {showMoreActions ? (
              <div className="absolute left-3 top-14 z-20 w-[calc(100vw-1.5rem)] max-w-56 rounded-xl border border-white/10 bg-[#242424] p-2 shadow-xl sm:left-6">
                  {["Mark unread", "Clear search", "Restore demo messages"].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        if (label === "Mark unread") {
                          if (selectedMessage && isMailApiConfigured) {
                            void markMailMessageSeen(selectedMessage.id, false).catch((error) =>
                              showPanel("status", error instanceof Error ? error.message : "Unable to mark unread."),
                            );
                          }
                          updateSelectedMessage({ unread: true }, "Message marked unread.");
                        }
                        if (label === "Clear search") setSearchQuery("");
                        if (label === "Restore demo messages") void handleRefresh();
                        setShowMoreActions(false);
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-[#d0d0d0] transition hover:bg-white/5 hover:text-white"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="px-4 pb-3 sm:px-6">
              <div className="truncate text-[28px] font-semibold text-[#d7d7d7] sm:text-[33px]">{getViewLabel(selectedView)}</div>
              <div className="mt-1 text-sm text-[#8a8a8a]">{visibleMessages.length} messages</div>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 pb-3 sm:px-6">
              <div className="flex items-center gap-4 text-[#9f9f9f]">
                <Circle className="h-3.5 w-3.5 fill-[#ff9a63] text-[#ff9a63]" />
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={showUnreadOnly}
                    onChange={() => setShowUnreadOnly((current) => !current)}
                    className="h-4 w-4 rounded border-white/10 bg-transparent accent-[#d45f16]"
                  />
                  Unread only
                </label>
              </div>
              <button
                type="button"
                onClick={() => setShowMoreActions((current) => !current)}
                className="rounded p-2 text-[#8f8f8f] transition hover:bg-[#2a2a2a] hover:text-white"
                aria-label="More message options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>

            {activePanel ? (
              <div className="mx-3 mb-3 rounded-xl border border-white/10 bg-[#242424] p-4 text-sm text-[#d3d3d3] sm:mx-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-white">{panelTitles[activePanel]}</p>
                    <p className="mt-1">{panelMessage}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActivePanel(null)}
                    className="rounded p-1 text-[#9a9a9a] transition hover:bg-white/5 hover:text-white"
                    aria-label="Close panel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {activePanel === "compose" ? (
                  <div className="mt-4 grid gap-3">
                    <Input
                      value={draftTo}
                      onChange={(event) => setDraftTo(event.target.value)}
                      placeholder="To"
                      className="h-10 border-white/5 bg-[#181818] text-[#f0f0f0]"
                    />
                    <Input
                      value={draftSubject}
                      onChange={(event) => setDraftSubject(event.target.value)}
                      placeholder="Subject"
                      className="h-10 border-white/5 bg-[#181818] text-[#f0f0f0]"
                    />
                    <textarea
                      value={draftText}
                      onChange={(event) => setDraftText(event.target.value)}
                      placeholder="Write your message..."
                      className="min-h-24 rounded-md border border-white/5 bg-[#181818] px-3 py-2 text-sm text-[#f0f0f0] outline-none placeholder:text-[#8a8a8a] focus:ring-2 focus:ring-[#444]"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSendDraft()}
                      className="w-fit rounded bg-[#b04e12] px-4 py-2 font-semibold text-white transition hover:bg-[#c85a15]"
                    >
                      Send email
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="min-h-0 min-w-0 flex-1 px-3 pb-0 sm:px-6">
              <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-t-md border border-white/5 border-b-0 bg-[#1f1f1f]">
                {visibleMessages.length ? (
                  <ScrollArea className="min-h-0 flex-1">
                    <div className="divide-y divide-white/10">
                      {visibleMessages.map((message) => (
                        <MessageRow
                          key={message.id}
                          message={message}
                          isSelected={message.id === selectedMessage?.id}
                          onSelect={() => openMessage(message)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-[#8d8d8d]">
                    <div>
                      <p className="text-base font-medium text-[#d0d0d0]">{emptyCopy[selectedFolder].title}</p>
                      <p className="mt-2">{emptyCopy[selectedFolder].detail}</p>
                    </div>
                  </div>
                )}
                <div className="border-t border-white/5 px-4 py-4 text-center text-sm text-[#9a9a9a]">
                  {lastUpdated} · {mailApiStatus}
                </div>
              </div>
            </div>
          </main>

          {isMessageOpen && selectedMessage ? (
            <MessageReader
              message={selectedMessage}
              onClose={() => setIsMessageOpen(false)}
              onReply={() => {
                setDraftTo(selectedMessage.fromAddress);
                setDraftSubject(`Re: ${selectedMessage.subject}`);
                setDraftText("");
                setIsMessageOpen(false);
                showPanel("compose", `Reply draft for "${selectedMessage.subject}"`);
              }}
              onArchive={() => void handleAction("Archive")}
              onTrash={() => void handleDelete()}
            />
          ) : null}

          <aside className="hidden border-l border-white/5 bg-[#1b1b1b] py-4 lg:block">
            <div className="flex flex-col items-center gap-3">
              {utilityIcons.map((Icon, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() =>
                    showPanel(index === 0 ? "module" : "status", index === 0 ? "Calendar is ready for the next screen." : "Chat opened.")
                  }
                  className="rounded bg-[#252525] p-3 text-[#9b9b9b] transition hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>

            <div className="absolute bottom-16 right-0">
              <div className="rounded-l bg-[#b04e12] px-2 py-10 text-xs font-semibold tracking-wide text-white [writing-mode:vertical-rl] [text-orientation:mixed]">
                Feedback
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

function capitalizeFolder(folder: MailFolderId) {
  return folder.charAt(0).toUpperCase() + folder.slice(1);
}

function isMailFolderId(view: MailboxViewId): view is MailFolderId {
  return view === "inbox" || view === "starred" || view === "important" || view === "archive";
}

function getViewLabel(view: MailboxViewId) {
  if (view.startsWith("custom:")) return view.replace("custom:", "");
  if (isMailFolderId(view)) return capitalizeFolder(view);

  return systemFolders.find((folder) => folder.id === view)?.label ?? "Mailbox";
}

function getViewCount(messages: MailMessage[], view: MailboxViewId) {
  return getVisibleMessagesForView(messages, view, { query: "", unreadOnly: false }).length;
}

function getApiFolder(view: MailboxViewId) {
  if (view === "starred" || view === "important" || view.startsWith("custom:")) return "inbox";
  return view;
}

function getVisibleMessagesForView(
  messages: MailMessage[],
  view: MailboxViewId,
  filters: Pick<Parameters<typeof getVisibleMessages>[1], "query" | "unreadOnly">,
) {
  if (isMailFolderId(view)) {
    return getVisibleMessages(messages, { folder: view, query: filters.query, unreadOnly: filters.unreadOnly });
  }

  const normalizedQuery = filters.query.trim().toLowerCase();
  const customTerm = view.startsWith("custom:") ? view.replace("custom:", "").toLowerCase() : "";
  const systemView = systemFolders.some((folder) => folder.id === view);

  return messages.filter((message) => {
    if (filters.unreadOnly && !message.unread) return false;

    const matchesView = view.startsWith("custom:")
      ? [message.from, message.fromAddress, message.subject, message.preview, ...message.tags]
          .join(" ")
          .toLowerCase()
          .includes(customTerm)
      : systemView;

    if (!matchesView) return false;
    if (!normalizedQuery) return true;

    return [message.from, message.fromAddress, message.subject, message.preview, ...message.tags]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
}

function getInitials(value: string) {
  return value
    .split(/[@\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

type LoginScreenProps = {
  email: string;
  password: string;
  error: string;
  isLoggingIn: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const LoginScreen = ({
  email,
  password,
  error,
  isLoggingIn,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: LoginScreenProps) => (
  <div className="flex min-h-screen w-full items-center justify-center bg-[#171717] px-4 py-10 text-[#d9d9d9]">
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101010] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
    >
      <p className="text-xs uppercase tracking-[0.34em] text-[#d17a46]">Mail App</p>
      <h1 className="mt-3 text-3xl font-semibold text-white">Sign in to your mailbox</h1>
      <p className="mt-3 text-sm leading-6 text-[#a7a7a7]">
        Use your IONOS mailbox email and password. Credentials are sent to the local mail API for this session and are
        not stored in the app bundle or `.env`.
      </p>

      <div className="mt-6 grid gap-3">
        <label className="grid gap-2 text-sm text-[#cfcfcf]">
          Email address
          <Input
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            type="email"
            autoComplete="username"
            placeholder="you@yourdomain.com"
            className="h-11 border-white/10 bg-[#1d1d1d] text-white"
            required
          />
        </label>
        <label className="grid gap-2 text-sm text-[#cfcfcf]">
          Password
          <Input
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            type="password"
            autoComplete="current-password"
            placeholder="Mailbox password"
            className="h-11 border-white/10 bg-[#1d1d1d] text-white"
            required
          />
        </label>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isLoggingIn}
        className="mt-6 h-11 w-full rounded-xl bg-[#b04e12] font-semibold text-white transition hover:bg-[#c85a15] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoggingIn ? "Signing in..." : "Sign in"}
      </button>
    </form>
  </div>
);

type MessageReaderProps = {
  message: MailMessage;
  onClose: () => void;
  onReply: () => void;
  onArchive: () => void;
  onTrash: () => void;
};

const MessageReader = ({ message, onClose, onReply, onArchive, onTrash }: MessageReaderProps) => (
  <div className="fixed inset-0 z-50 flex bg-[#111111] text-[#d9d9d9] lg:absolute lg:inset-y-0 lg:left-[286px] lg:right-[52px]">
    <div className="flex min-h-0 w-full flex-col bg-[#1c1c1c]">
      <div
        className="border-b border-white/10 bg-[#101010] px-4 pb-3"
        style={{ paddingTop: "var(--app-safe-top)" }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 text-[#d0d0d0] transition hover:bg-white/5 hover:text-white"
            aria-label="Back to inbox"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-[#9a9a9a]">{message.fromAddress}</p>
            <h2 className="truncate text-lg font-semibold text-white">{message.subject}</h2>
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto text-[#a8a8a8]">
          <button
            type="button"
            onClick={onReply}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-[#242424] px-3 py-2 text-sm transition hover:bg-[#303030] hover:text-white"
          >
            <Reply className="h-4 w-4" />
            Reply
          </button>
          <button
            type="button"
            onClick={onArchive}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-[#242424] px-3 py-2 text-sm transition hover:bg-[#303030] hover:text-white"
          >
            <Archive className="h-4 w-4" />
            Archive
          </button>
          <button
            type="button"
            onClick={onTrash}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-[#242424] px-3 py-2 text-sm transition hover:bg-[#303030] hover:text-white"
          >
            <Trash2 className="h-4 w-4" />
            Trash
          </button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <article className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6">
          <div className="rounded-2xl border border-white/10 bg-[#222] p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-white">{message.from}</p>
                <p className="break-all text-sm text-[#a6a6a6]">{message.fromAddress}</p>
              </div>
              <p className="shrink-0 text-right text-xs text-[#8f8f8f]">{message.receivedAt}</p>
            </div>
            <h1 className="mt-5 text-2xl font-semibold leading-tight text-white">{message.subject}</h1>
          </div>

          <div className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-[#f4f0e8] p-5 text-[15px] leading-7 text-[#1f1f1f]">
            {message.body.length ? (
              message.body.map((paragraph, index) => (
                <p key={`${message.id}-${index}`} className="break-words">
                  {paragraph}
                </p>
              ))
            ) : (
              <p>{message.preview || "No message body available."}</p>
            )}
          </div>
        </article>
      </ScrollArea>
    </div>
  </div>
);

type MessageRowProps = {
  message: MailMessage;
  isSelected: boolean;
  onSelect: () => void;
};

const MessageRow = ({ message, isSelected, onSelect }: MessageRowProps) => (
  <button
    type="button"
    onClick={onSelect}
    className={cn(
      "grid w-full min-w-0 grid-cols-[20px_minmax(0,1fr)_auto] gap-x-2 gap-y-1 px-3 py-3 text-left text-sm transition sm:grid-cols-[44px_44px_minmax(150px,200px)_minmax(0,1fr)_90px] sm:items-center sm:gap-0 sm:px-2 md:grid-cols-[44px_44px_minmax(150px,200px)_minmax(200px,1fr)_120px]",
      isSelected ? "bg-[#cf5b15] text-white" : "bg-[#1f1f1f] text-[#bfbfbf] hover:bg-[#2a2a2a]",
    )}
  >
    <div className="row-span-2 flex items-start justify-center pt-1 sm:row-span-1 sm:items-center sm:pt-0">
      {message.unread ? (
        <Circle className={cn("h-3 w-3 fill-[#ffa36e] text-[#ffa36e]", isSelected && "fill-white text-white")} />
      ) : (
        <span className="h-3 w-3" />
      )}
    </div>
    <div className="hidden items-center justify-center sm:flex">
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-[4px] border",
          isSelected ? "border-white/80 bg-white text-[#cf5b15]" : "border-[#9a9a9a]",
        )}
      >
        {isSelected ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      </span>
    </div>
    <div className="min-w-0">
      <p className={cn("truncate", isSelected ? "font-medium text-white" : message.unread ? "font-semibold text-[#d8d8d8]" : "font-medium text-[#bdbdbd]")}>
        {message.from}
      </p>
    </div>
    <div className="col-start-2 min-w-0 pr-0 sm:col-start-auto sm:pr-4">
      <div className="flex items-center gap-3">
        {message.hasAttachment ? (
          <Paperclip className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "text-white" : "text-[#8f8f8f]")} />
        ) : null}
        {message.starred && !isSelected ? <Star className="h-3.5 w-3.5 shrink-0 fill-[#ff9a63] text-[#ff9a63]" /> : null}
        <p className={cn("truncate", isSelected ? "text-white" : message.unread ? "font-semibold text-[#d7d7d7]" : "text-[#b9b9b9]")}>
          {message.subject}
        </p>
      </div>
    </div>
    <div className={cn("col-start-3 row-start-1 flex items-center justify-end gap-2 text-right text-xs sm:col-start-auto sm:row-start-auto", isSelected ? "text-white/95" : "text-[#979797]")}>
      {message.important && !isSelected ? <Clock3 className="h-3.5 w-3.5 text-[#9c9c9c]" /> : null}
      <span>{message.receivedAt}</span>
    </div>
  </button>
);

export default MailReader;
