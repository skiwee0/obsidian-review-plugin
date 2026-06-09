var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ReviewPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var import_view2 = require("@codemirror/view");

// src/editor.ts
var import_state = require("@codemirror/state");
var import_view = require("@codemirror/view");
var setReviewState = import_state.StateEffect.define();
var setReviewEnabled = import_state.StateEffect.define();
var setBaseText = import_state.StateEffect.define();
var acceptAllChanges = import_state.StateEffect.define();
var rejectAllChanges = import_state.StateEffect.define();
var acceptChange = import_state.StateEffect.define();
var rejectChange = import_state.StateEffect.define();
var internalChange = import_state.StateEffect.define();
var insertDecoration = import_view.Decoration.mark({
  class: "review-insert"
});
var DeletedTextWidget = class extends import_view.WidgetType {
  constructor(text) {
    super();
    this.text = text;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "review-delete";
    span.textContent = this.text;
    return span;
  }
};
function mapInsertMarks(inserts, changes, oldDocLength) {
  return inserts.filter(
    (mark) => mark.from >= 0 && mark.to >= mark.from && mark.to <= oldDocLength
  ).map((mark) => ({
    from: changes.mapPos(mark.from),
    to: changes.mapPos(mark.to)
  })).filter(
    (mark) => mark.from >= 0 && mark.to >= mark.from
  );
}
function mapDeleteMarks(deletes, changes, oldDocLength) {
  return deletes.filter(
    (mark) => mark.from >= 0 && mark.from <= oldDocLength
  ).map((mark) => ({
    from: changes.mapPos(mark.from),
    text: mark.text
  })).filter(
    (mark) => mark.from >= 0
  );
}
function sanitizeReviewData(data, docLength) {
  var _a;
  return {
    enabled: data.enabled,
    baseText: (_a = data.baseText) != null ? _a : "",
    inserts: data.inserts.filter(
      (mark) => mark.from >= 0 && mark.to >= mark.from && mark.to <= docLength
    ),
    deletes: data.deletes.filter(
      (mark) => mark.from >= 0 && mark.from <= docLength
    )
  };
}
var reviewState = import_state.StateField.define({
  create() {
    return {
      enabled: false,
      baseText: "",
      inserts: [],
      deletes: []
    };
  },
  update(value, tr) {
    let state = {
      enabled: value.enabled,
      baseText: value.baseText,
      inserts: [...value.inserts],
      deletes: [...value.deletes]
    };
    const isInternal = tr.effects.some(
      (effect) => effect.is(internalChange)
    );
    const isRejectAll = tr.effects.some(
      (effect) => effect.is(rejectAllChanges)
    );
    const oldInserts = [...state.inserts];
    if (tr.docChanged && !isRejectAll && state.enabled) {
      const oldDocLength = tr.startState.doc.length;
      state.inserts = mapInsertMarks(
        state.inserts,
        tr.changes,
        oldDocLength
      );
      state.deletes = mapDeleteMarks(
        state.deletes,
        tr.changes,
        oldDocLength
      );
    }
    for (const effect of tr.effects) {
      if (effect.is(setReviewState)) {
        state = sanitizeReviewData(
          effect.value,
          tr.state.doc.length
        );
      }
      if (effect.is(setReviewEnabled)) {
        state.enabled = effect.value;
      }
      if (effect.is(setBaseText)) {
        state.baseText = effect.value;
      }
      if (effect.is(acceptAllChanges)) {
        state.inserts = [];
        state.deletes = [];
      }
      if (effect.is(rejectAllChanges)) {
        state.enabled = false;
        state.inserts = [];
        state.deletes = [];
      }
      if (effect.is(acceptChange)) {
        const change = effect.value;
        if (change.type === "insert") {
          const newInserts = [];
          for (const mark of state.inserts) {
            const overlaps = mark.from < change.to && mark.to > change.from;
            if (!overlaps) {
              newInserts.push(mark);
              continue;
            }
            if (mark.from < change.from) {
              newInserts.push({
                from: mark.from,
                to: change.from
              });
            }
            if (mark.to > change.to) {
              newInserts.push({
                from: change.to,
                to: mark.to
              });
            }
          }
          state.inserts = newInserts;
        }
        if (change.type === "delete") {
          state.deletes = state.deletes.filter(
            (mark) => Math.abs(mark.from - change.from) > 2
          );
        }
      }
      if (effect.is(rejectChange)) {
        const change = effect.value;
        if (change.type === "insert") {
          const newInserts = [];
          for (const mark of state.inserts) {
            const overlaps = mark.from < change.to && mark.to > change.from;
            if (!overlaps) {
              newInserts.push(mark);
              continue;
            }
            if (mark.from < change.from) {
              newInserts.push({
                from: mark.from,
                to: change.from
              });
            }
            if (mark.to > change.to) {
              newInserts.push({
                from: change.to,
                to: mark.to
              });
            }
          }
          state.inserts = newInserts;
        }
        if (change.type === "delete") {
          state.deletes = state.deletes.filter(
            (mark) => Math.abs(mark.from - change.from) > 2
          );
        }
      }
    }
    if (state.enabled && tr.docChanged && !isInternal && !isRejectAll) {
      tr.changes.iterChanges(
        (fromA, toA, fromB, toB, inserted) => {
          const insertedLength = toB - fromB;
          const removedLength = toA - fromA;
          if (insertedLength > 0) {
            const last = state.inserts[state.inserts.length - 1];
            if (last && last.to === fromB) {
              last.to = toB;
            } else {
              state.inserts.push({
                from: fromB,
                to: toB
              });
            }
          }
          if (removedLength > 0) {
            const removedWasInsert = oldInserts.some(
              (mark) => fromA >= mark.from && toA <= mark.to
            );
            if (!removedWasInsert) {
              const removedText = tr.startState.doc.sliceString(
                fromA,
                toA
              );
              state.deletes.push({
                from: fromB,
                text: removedText
              });
            }
          }
        }
      );
    }
    return state;
  }
});
var reviewDecorations = import_state.StateField.define({
  create() {
    return import_view.Decoration.none;
  },
  update(_, tr) {
    const review = tr.state.field(reviewState);
    const builder = new import_state.RangeSetBuilder();
    const items = [];
    for (const mark of review.inserts) {
      items.push({
        from: mark.from,
        to: mark.to,
        decoration: insertDecoration
      });
    }
    for (const mark of review.deletes) {
      items.push({
        from: mark.from,
        to: mark.from,
        decoration: import_view.Decoration.widget({
          widget: new DeletedTextWidget(
            mark.text
          ),
          side: -1
        })
      });
    }
    items.sort((a, b) => {
      if (a.from !== b.from) {
        return a.from - b.from;
      }
      return a.to - b.to;
    });
    for (const item of items) {
      try {
        builder.add(
          item.from,
          item.to,
          item.decoration
        );
      } catch (e) {
      }
    }
    return builder.finish();
  },
  provide: (field) => import_view.EditorView.decorations.from(field)
});

// src/main.ts
var ReviewPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.reviewData = {};
    this.saveTimer = null;
  }
  async onload() {
    const loaded = await this.loadData();
    if (loaded) {
      this.reviewData = loaded;
    }
    this.registerEditorExtension([
      reviewState,
      reviewDecorations,
      import_view2.EditorView.updateListener.of(
        (update) => {
          this.handleEditorUpdate(update);
        }
      )
    ]);
    this.registerEvent(
      this.app.workspace.on(
        "active-leaf-change",
        () => {
          window.setTimeout(
            () => this.restoreActiveFileState(),
            100
          );
        }
      )
    );
    this.registerEvent(
      this.app.workspace.on(
        "file-open",
        () => {
          window.setTimeout(
            () => this.restoreActiveFileState(),
            100
          );
        }
      )
    );
    this.registerEvent(
      this.app.workspace.on(
        "editor-menu",
        (menu, editor) => {
          const cm = editor.cm;
          const review = this.getReviewState(cm);
          if (!review) {
            return;
          }
          const selected = this.findSelectedChange(cm, review);
          if (selected) {
            menu.addItem(
              (item) => item.setTitle("\u041F\u0440\u0438\u043D\u044F\u0442\u044C \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u043E\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435").onClick(() => {
                this.acceptSelectedChange(
                  cm,
                  selected
                );
              })
            );
            menu.addItem(
              (item) => item.setTitle("\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u043E\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435").onClick(() => {
                this.rejectSelectedChange(
                  cm,
                  selected
                );
              })
            );
            menu.addSeparator();
          }
          menu.addItem(
            (item) => item.setTitle(
              review.enabled ? "\u041E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0440\u0435\u0446\u0435\u043D\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435" : "\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0440\u0435\u0446\u0435\u043D\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435"
            ).onClick(() => {
              if (review.enabled) {
                this.disableReview(cm);
              } else {
                this.enableReview(cm);
              }
            })
          );
          menu.addSeparator();
          menu.addItem(
            (item) => item.setTitle("\u041F\u0440\u0438\u043D\u044F\u0442\u044C \u0432\u0441\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F").onClick(() => {
              this.acceptAll(cm);
            })
          );
          menu.addItem(
            (item) => item.setTitle("\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u0432\u0441\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F").onClick(() => {
              this.rejectAll(cm);
            })
          );
        }
      )
    );
    this.addCommand({
      id: "review-enable",
      name: "\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0440\u0435\u0436\u0438\u043C \u0440\u0435\u0446\u0435\u043D\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F",
      editorCallback: (editor) => {
        const cm = editor.cm;
        this.enableReview(cm);
      }
    });
    this.addCommand({
      id: "review-disable",
      name: "\u041E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0440\u0435\u0436\u0438\u043C \u0440\u0435\u0446\u0435\u043D\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F",
      editorCallback: (editor) => {
        const cm = editor.cm;
        this.disableReview(cm);
      }
    });
    this.addCommand({
      id: "review-accept-all",
      name: "\u041F\u0440\u0438\u043D\u044F\u0442\u044C \u0432\u0441\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F",
      editorCallback: (editor) => {
        const cm = editor.cm;
        this.acceptAll(cm);
      }
    });
    this.addCommand({
      id: "review-reject-all",
      name: "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u0432\u0441\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F",
      editorCallback: (editor) => {
        const cm = editor.cm;
        this.rejectAll(cm);
      }
    });
    this.addCommand({
      id: "review-accept-selection",
      name: "\u041F\u0440\u0438\u043D\u044F\u0442\u044C \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u043E\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435",
      editorCallback: (editor) => {
        const cm = editor.cm;
        const review = this.getReviewState(cm);
        if (!review) {
          return;
        }
        const selected = this.findSelectedChange(cm, review);
        if (!selected) {
          new import_obsidian.Notice("\u0412\u044B\u0434\u0435\u043B\u0438\u0442\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435");
          return;
        }
        this.acceptSelectedChange(cm, selected);
      }
    });
    this.addCommand({
      id: "review-reject-selection",
      name: "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u043E\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435",
      editorCallback: (editor) => {
        const cm = editor.cm;
        const review = this.getReviewState(cm);
        if (!review) {
          return;
        }
        const selected = this.findSelectedChange(cm, review);
        if (!selected) {
          new import_obsidian.Notice("\u0412\u044B\u0434\u0435\u043B\u0438\u0442\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435");
          return;
        }
        this.rejectSelectedChange(cm, selected);
      }
    });
    window.setTimeout(
      () => this.restoreActiveFileState(),
      300
    );
    console.log("Review plugin loaded");
  }
  getFilePath() {
    var _a;
    const file = this.app.workspace.getActiveFile();
    return (_a = file == null ? void 0 : file.path) != null ? _a : null;
  }
  getActiveEditorView() {
    var _a;
    const view = this.app.workspace.getActiveViewOfType(
      import_obsidian.MarkdownView
    );
    const cm = (_a = view == null ? void 0 : view.editor) == null ? void 0 : _a.cm;
    return cm != null ? cm : null;
  }
  getReviewState(cm) {
    try {
      return cm.state.field(reviewState);
    } catch (e) {
      return null;
    }
  }
  scheduleSaveData() {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
    }
    this.saveTimer = window.setTimeout(() => {
      this.saveData(this.reviewData);
      this.saveTimer = null;
    }, 300);
  }
  saveCurrentState(cm) {
    const path = this.getFilePath();
    if (!path) {
      return;
    }
    const review = this.getReviewState(cm);
    if (!review) {
      return;
    }
    this.reviewData[path] = {
      enabled: review.enabled,
      baseText: review.baseText,
      inserts: [...review.inserts],
      deletes: [...review.deletes]
    };
    this.saveData(this.reviewData);
  }
  handleEditorUpdate(update) {
    if (!update.docChanged) {
      return;
    }
    const path = this.getFilePath();
    if (!path) {
      return;
    }
    const review = this.getReviewState(update.view);
    if (!review) {
      return;
    }
    const existing = this.reviewData[path];
    const reviewIsEmpty = !review.enabled && review.baseText === "" && review.inserts.length === 0 && review.deletes.length === 0;
    const existingHasReview = existing && (existing.enabled || existing.inserts.length > 0 || existing.deletes.length > 0);
    if (reviewIsEmpty && existingHasReview && !update.docChanged) {
      console.log(
        "SKIP EMPTY AUTO SAVE",
        path
      );
      return;
    }
    this.reviewData[path] = {
      enabled: review.enabled,
      baseText: review.baseText,
      inserts: [...review.inserts],
      deletes: [...review.deletes]
    };
    console.log(
      "AUTO SAVE REVIEW",
      path,
      this.reviewData[path]
    );
    this.saveData(this.reviewData);
  }
  restoreActiveFileState(attempt = 0) {
    const path = this.getFilePath();
    if (!path) {
      return;
    }
    const saved = this.reviewData[path];
    if (!saved) {
      return;
    }
    const cm = this.getActiveEditorView();
    if (!cm) {
      return;
    }
    const docLength = cm.state.doc.length;
    const maxInsert = saved.inserts.reduce(
      (max, mark) => Math.max(max, mark.to),
      0
    );
    const maxDelete = saved.deletes.reduce(
      (max, mark) => Math.max(max, mark.from),
      0
    );
    const maxPosition = Math.max(maxInsert, maxDelete);
    if (maxPosition > 0 && docLength < maxPosition) {
      if (attempt < 20) {
        window.setTimeout(
          () => this.restoreActiveFileState(
            attempt + 1
          ),
          100
        );
      }
      return;
    }
    cm.dispatch({
      effects: setReviewState.of(saved)
    });
  }
  enableReview(cm) {
    const current = this.getReviewState(cm);
    const hasExistingChanges = current && (current.inserts.length > 0 || current.deletes.length > 0);
    const data = {
      enabled: true,
      baseText: hasExistingChanges ? current.baseText : cm.state.doc.toString(),
      inserts: hasExistingChanges ? [...current.inserts] : [],
      deletes: hasExistingChanges ? [...current.deletes] : []
    };
    cm.dispatch({
      effects: setReviewState.of(data)
    });
    this.saveCurrentState(cm);
    new import_obsidian.Notice("\u0420\u0435\u0446\u0435\u043D\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u043E");
  }
  disableReview(cm) {
    cm.dispatch({
      effects: setReviewEnabled.of(false)
    });
    this.saveCurrentState(cm);
    new import_obsidian.Notice("\u0420\u0435\u0446\u0435\u043D\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u043E");
  }
  refocusEditor(cm) {
    const focus = () => {
      const leaf = this.app.workspace.activeLeaf;
      if (leaf) {
        this.app.workspace.setActiveLeaf(
          leaf,
          { focus: true }
        );
      }
      const view = this.app.workspace.getActiveViewOfType(
        import_obsidian.MarkdownView
      );
      const editor = view == null ? void 0 : view.editor;
      if (editor == null ? void 0 : editor.focus) {
        editor.focus();
      }
      cm.focus();
      cm.contentDOM.focus();
    };
    window.setTimeout(focus, 50);
    window.setTimeout(focus, 200);
    window.setTimeout(focus, 500);
    window.setTimeout(focus, 1e3);
  }
  confirmDialog(message) {
    return new Promise((resolve) => {
      const modal = new import_obsidian.Modal(this.app);
      let resolved = false;
      const finish = (result) => {
        if (resolved) {
          return;
        }
        resolved = true;
        resolve(result);
        modal.close();
      };
      modal.contentEl.createEl(
        "p",
        {
          text: message
        }
      );
      const buttons = modal.contentEl.createDiv();
      const okButton = buttons.createEl(
        "button",
        {
          text: "\u041E\u041A"
        }
      );
      const cancelButton = buttons.createEl(
        "button",
        {
          text: "\u041E\u0442\u043C\u0435\u043D\u0430"
        }
      );
      okButton.onclick = () => {
        finish(true);
      };
      cancelButton.onclick = () => {
        finish(false);
      };
      modal.onClose = () => {
        finish(false);
      };
      modal.open();
    });
  }
  async acceptAll(cm) {
    const review = this.getReviewState(cm);
    if (!review) {
      return;
    }
    const confirmed = await this.confirmDialog(
      "\u041F\u0440\u0438\u043D\u044F\u0442\u044C \u0432\u0441\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u0432 \u0444\u0430\u0439\u043B\u0435?"
    );
    if (!confirmed) {
      this.refocusEditor(cm);
      return;
    }
    const cleanState = {
      enabled: review.enabled,
      baseText: cm.state.doc.toString(),
      inserts: [],
      deletes: []
    };
    cm.dispatch({
      effects: setReviewState.of(cleanState)
    });
    this.saveCurrentState(cm);
    new import_obsidian.Notice("\u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043F\u0440\u0438\u043D\u044F\u0442\u044B");
    this.refocusEditor(cm);
  }
  async rejectAll(cm) {
    const review = this.getReviewState(cm);
    if (!review) {
      return;
    }
    const confirmed = await this.confirmDialog(
      "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u0432\u0441\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u0432 \u0444\u0430\u0439\u043B\u0435?"
    );
    if (!confirmed) {
      return;
    }
    const cleanState = {
      enabled: false,
      baseText: review.baseText,
      inserts: [],
      deletes: []
    };
    cm.dispatch({
      changes: {
        from: 0,
        to: cm.state.doc.length,
        insert: review.baseText
      },
      effects: [
        internalChange.of(),
        setReviewState.of(cleanState)
      ]
    });
    this.saveCurrentState(cm);
    new import_obsidian.Notice("\u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u044B");
  }
  findSelectedChange(cm, review) {
    const selection = cm.state.selection.main;
    const insert = review.inserts.find((mark) => {
      if (selection.empty) {
        return selection.from >= mark.from && selection.from <= mark.to;
      }
      return selection.from < mark.to && selection.to > mark.from;
    });
    if (insert) {
      return {
        type: "insert",
        from: selection.empty ? insert.from : Math.max(selection.from, insert.from),
        to: selection.empty ? insert.to : Math.min(selection.to, insert.to)
      };
    }
    const deleteMark = review.deletes.find(
      (mark) => Math.abs(selection.from - mark.from) <= 2 || selection.from <= mark.from && selection.to >= mark.from
    );
    if (deleteMark) {
      return {
        type: "delete",
        from: deleteMark.from,
        to: deleteMark.from,
        text: deleteMark.text
      };
    }
    return null;
  }
  buildBaseTextFromCurrentState(cm, review) {
    let text = cm.state.doc.toString();
    const inserts = [...review.inserts].sort(
      (a, b) => b.from - a.from
    );
    for (const mark of inserts) {
      text = text.slice(0, mark.from) + text.slice(mark.to);
    }
    const deletes = [...review.deletes].sort(
      (a, b) => b.from - a.from
    );
    for (const mark of deletes) {
      text = text.slice(0, mark.from) + mark.text + text.slice(mark.from);
    }
    return text;
  }
  acceptSelectedChange(cm, selected) {
    const review = this.getReviewState(cm);
    if (!review) {
      return;
    }
    if (selected.type === "insert") {
      const nextInserts = review.inserts.filter(
        (mark) => !(mark.from < selected.to && mark.to > selected.from)
      );
      const nextState = {
        enabled: review.enabled,
        baseText: cm.state.doc.toString(),
        inserts: nextInserts,
        deletes: [...review.deletes]
      };
      cm.dispatch({
        effects: setReviewState.of(nextState)
      });
      this.saveCurrentState(cm);
      this.refocusEditor(cm);
      new import_obsidian.Notice("\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u043F\u0440\u0438\u043D\u044F\u0442\u043E");
      return;
    }
    if (selected.type === "delete") {
      const nextDeletes = review.deletes.filter(
        (mark) => Math.abs(
          mark.from - selected.from
        ) > 2
      );
      const nextState = {
        enabled: review.enabled,
        baseText: cm.state.doc.toString(),
        inserts: [...review.inserts],
        deletes: nextDeletes
      };
      cm.dispatch({
        effects: setReviewState.of(nextState)
      });
      this.saveCurrentState(cm);
      this.refocusEditor(cm);
      new import_obsidian.Notice("\u0423\u0434\u0430\u043B\u0435\u043D\u0438\u0435 \u043F\u0440\u0438\u043D\u044F\u0442\u043E");
    }
  }
  rejectSelectedChange(cm, selected) {
    if (selected.type === "insert") {
      const review = this.getReviewState(cm);
      if (!review) {
        return;
      }
      const originalFrom = selected.from;
      const originalTo = selected.to;
      let from = selected.from;
      let to = selected.to;
      const doc = cm.state.doc.toString();
      if (from > 0 && doc[from - 1] === " ") {
        from--;
      } else if (to < doc.length && doc[to] === " ") {
        to++;
      }
      const deletedLength = to - from;
      const nextInserts = [];
      for (const mark of review.inserts) {
        const overlapsSelection = mark.from < originalTo && mark.to > originalFrom;
        if (!overlapsSelection) {
          if (mark.to <= from) {
            nextInserts.push({
              from: mark.from,
              to: mark.to
            });
          } else if (mark.from >= to) {
            nextInserts.push({
              from: mark.from - deletedLength,
              to: mark.to - deletedLength
            });
          }
          continue;
        }
        if (mark.from < from) {
          nextInserts.push({
            from: mark.from,
            to: from
          });
        }
        if (mark.to > originalTo) {
          nextInserts.push({
            from,
            to: mark.to - deletedLength
          });
        }
      }
      const nextDeletes = review.deletes.map((mark) => ({
        from: mark.from >= to ? mark.from - deletedLength : mark.from,
        text: mark.text
      }));
      cm.dispatch({
        changes: {
          from,
          to,
          insert: ""
        },
        effects: internalChange.of()
      });
      cm.dispatch({
        effects: setReviewState.of({
          enabled: review.enabled,
          baseText: review.baseText,
          inserts: nextInserts,
          deletes: nextDeletes
        })
      });
      this.saveCurrentState(cm);
      new import_obsidian.Notice("\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E");
      return;
    }
    if (selected.type === "delete") {
      cm.dispatch({
        effects: rejectChange.of({
          type: "delete",
          from: selected.from,
          to: selected.to
        })
      });
      cm.dispatch({
        changes: {
          from: selected.from,
          to: selected.from,
          insert: selected.text
        },
        effects: internalChange.of()
      });
      cm.dispatch({
        effects: acceptChange.of({
          type: "insert",
          from: selected.from,
          to: selected.from + selected.text.length
        })
      });
      this.saveCurrentState(cm);
      new import_obsidian.Notice("\u0423\u0434\u0430\u043B\u0435\u043D\u0438\u0435 \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u043E");
    }
  }
  onunload() {
    console.log("Review plugin unloaded");
  }
};
