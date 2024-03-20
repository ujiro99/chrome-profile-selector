import React from "react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { profile } from "../wailsjs/go/models";
import { List, Run } from "../wailsjs/go/main/App";
import { Quit, WindowMinimise } from "../wailsjs/runtime/runtime";
import { useTranslation } from "react-i18next";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileList } from "@/components/ProfileList";
import { CollectionAdd } from "@/components/CollectionAdd";
import { CollectionDelete } from "@/components/CollectionDelete";
import { Input } from "@/components/Input";
import { useHistory } from "@/hooks/useHistory";
import { useCollection } from "@/hooks/useCollection";
import { useConfig } from "@/hooks/useConfig";
import { useEnv } from "@/hooks/useEnv";
import { ConfigKey, BehaviorAfterLaunch } from "@/services/config";
import * as utils from "./lib/utils";
import type { ListItem, ProfileKey } from "./lib/utils";

import "./App.css";

const FocusDefault = 0;

interface TabList {
  [key: string]: ListItem[];
}

interface TabRefs {
  [key: string]: React.RefObject<HTMLButtonElement>;
}

const DEFAULT_TABS = ["all", "history"];
function isDefaultTab(tab: string): boolean {
  return DEFAULT_TABS.includes(tab);
}

function App() {
  const { collections, profileCollections } = useCollection();
  const tabs = [...DEFAULT_TABS, ...collections];
  const [list, setList] = useState<ListItem[]>([]);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState(FocusDefault);
  const [currentTab, _setCurrentTab] = useState(tabs[0]);
  const [errorMsg, setErrorMsg] = useState("");
  const [history, addHistory] = useHistory();
  const [config] = useConfig();
  const { t } = useTranslation();
  const { isDev } = useEnv();
  const indicatorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // コレクション毎のProfileKeyを作成
  const keys = useMemo(() => {
    return collections.reduce(
      (acc, cur) => {
        const pcs = profileCollections.filter((p) =>
          p.collections.includes(cur),
        );
        acc[cur] = pcs.map((p) => p.key);
        return acc;
      },
      {} as { [key: string]: ProfileKey[] },
    );
  }, [collections, profileCollections]);

  // 表示されるリストを作成
  const lists = useMemo(() => {
    // デフォルトのタブを追加
    const l = {
      all: utils.filter(list, query),
      history: utils.filter(utils.mapListItem(list, history), query),
    } as TabList;
    // コレクションのタブを追加
    for (const [k, v] of Object.entries(keys)) {
      l[k] = utils.sort(utils.filter(utils.mapListItem(list, v), query));
    }
    return l;
  }, [list, history, keys, query]);

  const refsByTabs = useMemo(() => {
    return tabs.reduce((acc, cur) => {
      acc[cur] = React.createRef<HTMLButtonElement>();
      return acc;
    }, {} as TabRefs);
  }, [tabs]);

  useEffect(() => {
    inputRef.current?.focus();
    List().then((profiles) => {
      console.table(profiles);
      setList(profiles.map((profile) => ({ profile })));
    });
  }, []);

  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      const key = e.code;
      if (key === "ArrowUp") {
        if (focus > FocusDefault) {
          setFocus((pre) => pre - 1);
          e.preventDefault();
        }
      } else if (key === "ArrowDown") {
        const filtered = lists[currentTab];
        if (focus < (filtered?.length || 0) - 1) {
          setFocus((pre) => pre + 1);
          e.preventDefault();
        }
      } else if (key === "ArrowLeft" || (key === "Tab" && e.shiftKey)) {
        setPrevTab();
        e.preventDefault();
      } else if (key === "ArrowRight" || key === "Tab") {
        setNextTab();
        e.preventDefault();
      } else if (key === "Enter") {
        const filtered = lists[currentTab];
        if (filtered) {
          const item = filtered[focus];
          if (item) {
            const { browser, directory } = item.profile;
            console.debug("Enter", browser, directory);
            onClick(item.profile);
            e.preventDefault();
          }
        }
      }
    };
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("keydown", keydown);
    };
  }, [currentTab, focus, lists]);

  // タブインジケーターの計算
  useEffect(() => {
    const ref = indicatorRef.current;
    if (ref) {
      const tab = refsByTabs[currentTab];
      const pad = 4;
      if (tab.current) {
        ref.style.left = `${tab.current.offsetLeft + pad}px`;
        ref.style.width = `${tab.current.offsetWidth - pad * 2}px`;
      }
    }
  }, [currentTab, refsByTabs]);

  const updateQuery = (e: any) => {
    setQuery(e.target.value);
    setFocus(FocusDefault);
  };

  const onClick = (p: profile.Profile) => {
    Run(p.browser, p.directory).then((err) => {
      setErrorMsg(err);
      if (!err) {
        // 履歴に追加
        addHistory(utils.profileKey(p));

        const behavior = config[ConfigKey.behaviorAfterLaunch];
        if (behavior === BehaviorAfterLaunch.minimize) {
          !isDev && WindowMinimise();
        } else if (behavior === BehaviorAfterLaunch.close) {
          // 開発モードの場合は再起動が面倒なため、終了しない
          !isDev && Quit();
        }
      }
    });
  };

  // 前のタブに移動
  const setPrevTab = useCallback(() => {
    let idx = tabs.findIndex((tab) => tab === currentTab);
    if (idx <= 0) {
      idx = tabs.length;
    }
    setCurrentTab(tabs[idx - 1]);
  }, [currentTab, tabs]);

  // 次のタブに移動
  const setNextTab = useCallback(() => {
    let idx = tabs.findIndex((tab) => tab === currentTab);
    idx = (idx + 1) % tabs.length;
    setCurrentTab(tabs[idx]);
  }, [currentTab, tabs]);

  // 削除したら、一つ前のタブに移動
  const onDeletedTab = (collection: string) => {
    if (collection === currentTab) {
      setPrevTab();
    }
  };

  // tabを移動したら、focusを長さに合わせる
  const setCurrentTab = (tab: string) => {
    _setCurrentTab(tab);
    setFocus(Math.min(focus, lists[tab]?.length - 1 || 0));
  };

  return (
    <div id="App">
      <div id="input" className="input-box">
        <Input onChange={updateQuery} placeholder={t("keywordSearch")} />
      </div>
      {errorMsg && <p className="error">{errorMsg}</p>}
      <Tabs
        defaultValue={tabs[0]}
        value={currentTab}
        className="w-full px-2 result-tabs"
        onValueChange={setCurrentTab}
      >
        <TabsList className="p-0 h-[auto] relative bg-transparent">
          {tabs.map((tab) => (
            <TabsTrigger
              className="tab-button"
              value={tab}
              key={tab}
              ref={refsByTabs[tab]}
            >
              {t(tab)}
            </TabsTrigger>
          ))}
          <CollectionAdd />
          <div className="tab-indicator" ref={indicatorRef} />
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent value={tab} key={tab} className="tab-content mt-3">
            <ScrollArea type="auto" className="h-full">
              {lists[tab] && (
                <ProfileList
                  list={lists[tab]}
                  focusIdx={focus}
                  onClick={onClick}
                />
              )}
              {!isDefaultTab(tab) && (
                <CollectionDelete
                  className="tab-remove"
                  collection={tab}
                  onDeleted={onDeletedTab}
                />
              )}
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export default App;
