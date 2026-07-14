"use client";

import {
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeft,
  Trash2,
  Settings2,
} from "lucide-react";
import type { Conversation, ChatSettings, ModelInfo } from "@/lib/types";

type SidebarProps = {
  open: boolean;
  onToggle: () => void;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  settings: ChatSettings;
  onSettingsChange: (settings: ChatSettings) => void;
  models: ModelInfo[];
  gatewayLabel: string;
};

export function Sidebar({
  open,
  onToggle,
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  settingsOpen,
  onToggleSettings,
  settings,
  onSettingsChange,
  models,
  gatewayLabel,
}: SidebarProps) {
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <>
      <aside className={`sidebar ${open ? "open" : "collapsed"}`}>
        <div className="sidebar-top">
          <button type="button" className="sidebar-btn primary" onClick={onNewChat}>
            <MessageSquarePlus size={16} />
            New chat
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onToggle}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        <div className="sidebar-section-label">Your chats</div>
        <div className="conversation-list">
          {sorted.length === 0 ? (
            <p className="sidebar-empty">Start a conversation</p>
          ) : (
            sorted.map((conversation) => (
              <div
                key={conversation.id}
                className={`conversation-item ${
                  conversation.id === activeId ? "active" : ""
                }`}
              >
                <button
                  type="button"
                  className="conversation-title"
                  onClick={() => onSelect(conversation.id)}
                >
                  {conversation.title}
                </button>
                <button
                  type="button"
                  className="conversation-delete"
                  onClick={() => onDelete(conversation.id)}
                  aria-label="Delete chat"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          <button type="button" className="sidebar-btn ghost" onClick={onToggleSettings}>
            <Settings2 size={16} />
            Settings
          </button>
          <p className="gateway-pill" title={gatewayLabel}>
            {gatewayLabel}
          </p>
        </div>

        {settingsOpen ? (
          <div className="settings-panel">
            <label className="settings-field">
              <span>Model</span>
              <select
                value={settings.model}
                onChange={(event) =>
                  onSettingsChange({ ...settings, model: event.target.value })
                }
              >
                {[settings.model, ...models.map((model) => model.id)]
                  .filter((id, index, all) => all.indexOf(id) === index)
                  .map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
              </select>
            </label>
            <label className="settings-field">
              <span>Temperature ({settings.temperature.toFixed(1)})</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={settings.temperature}
                onChange={(event) =>
                  onSettingsChange({
                    ...settings,
                    temperature: Number(event.target.value),
                  })
                }
              />
            </label>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={settings.enableWebTools}
                onChange={(event) =>
                  onSettingsChange({
                    ...settings,
                    enableWebTools: event.target.checked,
                  })
                }
              />
              Enable web search tools
            </label>
          </div>
        ) : null}
      </aside>

      {!open ? (
        <button
          type="button"
          className="sidebar-reopen"
          onClick={onToggle}
          aria-label="Open sidebar"
        >
          <PanelLeft size={18} />
        </button>
      ) : null}
    </>
  );
}
