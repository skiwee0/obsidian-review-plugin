import {
    MarkdownView,
    Notice,
    Plugin
} from "obsidian";

import {
    EditorView,
    ViewUpdate
} from "@codemirror/view";

import {
    ReviewData,
    acceptAllChanges,
    acceptChange,
    internalChange,
    rejectAllChanges,
    rejectChange,
    reviewDecorations,
    reviewState,
    setReviewEnabled,
    setReviewState
} from "./editor";

type StoredReviewData =
    Record<string, ReviewData>;

export default class ReviewPlugin extends Plugin {

    private reviewData: StoredReviewData = {};

    async onload() {

        const loaded =
            await this.loadData();

        if (loaded) {
            this.reviewData = loaded;
        }

        this.registerEditorExtension([
    reviewState,
    reviewDecorations,

    EditorView.updateListener.of(
        (update: ViewUpdate) => {
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

                    const cm =
                        (editor as any).cm as EditorView;

                    const review =
                        this.getReviewState(cm);

                    if (!review) {
                        return;
                    }

                    const selected =
                        this.findSelectedChange(cm, review);

                    if (selected) {

                        menu.addItem(item =>
                            item
                                .setTitle("Принять выделенное изменение")
                                .onClick(() => {
                                    this.acceptSelectedChange(
                                        cm,
                                        selected
                                    );
                                })
                        );

                        menu.addItem(item =>
                            item
                                .setTitle("Отменить выделенное изменение")
                                .onClick(() => {
                                    this.rejectSelectedChange(
                                        cm,
                                        selected
                                    );
                                })
                        );

                        menu.addSeparator();
                    }

                    menu.addItem(item =>
                        item
                            .setTitle(
                                review.enabled
                                    ? "Отключить рецензирование"
                                    : "Включить рецензирование"
                            )
                            .onClick(() => {

                                if (review.enabled) {
                                    this.disableReview(cm);
                                } else {
                                    this.enableReview(cm);
                                }
                            })
                    );

                    menu.addSeparator();

                    menu.addItem(item =>
                        item
                            .setTitle("Принять все изменения")
                            .onClick(() => {
                                this.acceptAll(cm);
                            })
                    );

                    menu.addItem(item =>
                        item
                            .setTitle("Отменить все изменения")
                            .onClick(() => {
                                this.rejectAll(cm);
                            })
                    );
                }
            )
        );

        this.addCommand({
            id: "review-enable",
            name: "Включить режим рецензирования",
            editorCallback: (editor: any) => {
                const cm =
                    editor.cm as EditorView;

                this.enableReview(cm);
            }
        });

        this.addCommand({
            id: "review-disable",
            name: "Отключить режим рецензирования",
            editorCallback: (editor: any) => {
                const cm =
                    editor.cm as EditorView;

                this.disableReview(cm);
            }
        });

        this.addCommand({
            id: "review-accept-all",
            name: "Принять все изменения",
            editorCallback: (editor: any) => {
                const cm =
                    editor.cm as EditorView;

                this.acceptAll(cm);
            }
        });

        this.addCommand({
            id: "review-reject-all",
            name: "Отменить все изменения",
            editorCallback: (editor: any) => {
                const cm =
                    editor.cm as EditorView;

                this.rejectAll(cm);
            }
        });

        this.addCommand({
            id: "review-accept-selection",
            name: "Принять выделенное изменение",
            editorCallback: (editor: any) => {
                const cm =
                    editor.cm as EditorView;

                const review =
                    this.getReviewState(cm);

                if (!review) {
                    return;
                }

                const selected =
                    this.findSelectedChange(cm, review);

                if (!selected) {
                    new Notice("Выделите изменение");
                    return;
                }

                this.acceptSelectedChange(cm, selected);
            }
        });

        this.addCommand({
            id: "review-reject-selection",
            name: "Отменить выделенное изменение",
            editorCallback: (editor: any) => {
                const cm =
                    editor.cm as EditorView;

                const review =
                    this.getReviewState(cm);

                if (!review) {
                    return;
                }

                const selected =
                    this.findSelectedChange(cm, review);

                if (!selected) {
                    new Notice("Выделите изменение");
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

    private getFilePath(): string | null {

        const file =
            this.app.workspace.getActiveFile();

        return file?.path ?? null;
    }

    private getActiveEditorView(): EditorView | null {

        const view =
            this.app.workspace.getActiveViewOfType(
                MarkdownView
            );

        const cm =
            (view as any)?.editor?.cm as EditorView;

        return cm ?? null;
    }

    private getReviewState(
        cm: EditorView
    ): ReviewData | null {

        try {
            return cm.state.field(reviewState);
        } catch {
            return null;
        }
    }

    private async saveCurrentState(
        cm: EditorView
    ) {

        const path =
            this.getFilePath();

        if (!path) {
            return;
        }

        const review =
            this.getReviewState(cm);

        if (!review) {
            return;
        }

        this.reviewData[path] = {
            enabled: review.enabled,
            baseText: review.baseText,
            inserts: [...review.inserts],
            deletes: [...review.deletes]
        };

        await this.saveData(this.reviewData);
    }

  private async handleEditorUpdate(
    update: ViewUpdate
) {

    if (
        !update.docChanged &&
        update.transactions.every(
            tr => tr.effects.length === 0
        )
    ) {
        return;
    }

    const path =
        this.getFilePath();

    if (!path) {
        return;
    }

    const review =
        this.getReviewState(update.view);

    if (!review) {
        return;
    }

    const existing =
        this.reviewData[path];

    const reviewIsEmpty =
        !review.enabled &&
        review.baseText === "" &&
        review.inserts.length === 0 &&
        review.deletes.length === 0;

    const existingHasReview =
        existing &&
        (
            existing.enabled ||
            existing.inserts.length > 0 ||
            existing.deletes.length > 0
        );

    if (
        reviewIsEmpty &&
        existingHasReview &&
        !update.docChanged
    ) {
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

    await this.saveData(this.reviewData);
}

    private restoreActiveFileState(
    attempt = 0
) {

    const path =
        this.getFilePath();

    if (!path) {
        return;
    }

    const saved =
        this.reviewData[path];

    if (!saved) {
        return;
    }

    const cm =
        this.getActiveEditorView();

    if (!cm) {
        return;
    }

    const docLength =
        cm.state.doc.length;

    const maxInsert =
        saved.inserts.reduce(
            (max, mark) =>
                Math.max(max, mark.to),
            0
        );

    const maxDelete =
        saved.deletes.reduce(
            (max, mark) =>
                Math.max(max, mark.from),
            0
        );

    const maxPosition =
        Math.max(maxInsert, maxDelete);

    if (
        maxPosition > 0 &&
        docLength < maxPosition
    ) {
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
        effects:
            setReviewState.of(saved)
    });
}

    private enableReview(
    cm: EditorView
) {

    const current =
        this.getReviewState(cm);

    const hasExistingChanges =
        current &&
        (
            current.inserts.length > 0 ||
            current.deletes.length > 0
        );

    const data: ReviewData = {
        enabled: true,
        baseText: hasExistingChanges
            ? current.baseText
            : cm.state.doc.toString(),
        inserts: hasExistingChanges
            ? [...current.inserts]
            : [],
        deletes: hasExistingChanges
            ? [...current.deletes]
            : []
    };

    cm.dispatch({
        effects:
            setReviewState.of(data)
    });

    this.saveCurrentState(cm);

    new Notice("Рецензирование включено");
}

    private disableReview(
        cm: EditorView
    ) {

        cm.dispatch({
            effects:
                setReviewEnabled.of(false)
        });

        this.saveCurrentState(cm);

        new Notice("Рецензирование выключено");
    }

    private acceptAll(
        cm: EditorView
    ) {

        const review =
            this.getReviewState(cm);

        if (!review) {
            return;
        }

        const confirmed =
            window.confirm(
                "Принять все изменения в файле?"
            );

        if (!confirmed) {
            return;
        }

        cm.dispatch({
            effects:
                acceptAllChanges.of()
        });

        this.saveCurrentState(cm);

        new Notice("Изменения приняты");
    }

   private rejectAll(
    cm: EditorView
) {

    const review =
        this.getReviewState(cm);

    if (!review) {
        return;
    }

    const confirmed =
        window.confirm(
            "Отменить все изменения в файле?"
        );

    if (!confirmed) {
        return;
    }

    const cleanState: ReviewData = {
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

    new Notice("Изменения отменены");
}

    private findSelectedChange(
        cm: EditorView,
        review: ReviewData
    ) {

        const selection =
            cm.state.selection.main;

        const insert =
            review.inserts.find(mark =>
                selection.from >= mark.from &&
                selection.to <= mark.to
            );

        if (insert) {
    return {
        type: "insert" as const,
        from: selection.empty
            ? insert.from
            : selection.from,
        to: selection.empty
            ? insert.to
            : selection.to
    };
}

        const deleteMark =
            review.deletes.find(mark =>
                Math.abs(selection.from - mark.from) <= 2 ||
                (
                    selection.from <= mark.from &&
                    selection.to >= mark.from
                )
            );

        if (deleteMark) {
            return {
                type: "delete" as const,
                from: deleteMark.from,
                to: deleteMark.from,
                text: deleteMark.text
            };
        }

        return null;
    }

    private acceptSelectedChange(
        cm: EditorView,
        selected: any
    ) {

        if (selected.type === "insert") {
            cm.dispatch({
                effects:
                    acceptChange.of({
                        type: "insert",
                        from: selected.from,
                        to: selected.to
                    })
            });

            this.saveCurrentState(cm);

            new Notice("Добавление принято");
            return;
        }

        if (selected.type === "delete") {
            cm.dispatch({
                effects:
                    acceptChange.of({
                        type: "delete",
                        from: selected.from,
                        to: selected.to
                    })
            });

            this.saveCurrentState(cm);

            new Notice("Удаление принято");
        }
    }

   private rejectSelectedChange(
    cm: EditorView,
    selected: any
) {

    if (selected.type === "insert") {

    const review =
        this.getReviewState(cm);

    if (!review) {
        return;
    }

    const originalFrom =
        selected.from;

    const originalTo =
        selected.to;

    let from =
        selected.from;

    let to =
        selected.to;

    const doc =
        cm.state.doc.toString();

    if (
        from > 0 &&
        doc[from - 1] === " "
    ) {
        from--;
    } else if (
        to < doc.length &&
        doc[to] === " "
    ) {
        to++;
    }

    const deletedLength =
        to - from;

    const nextInserts: {
        from: number;
        to: number;
    }[] = [];

    for (const mark of review.inserts) {

        const overlapsSelection =
            mark.from < originalTo &&
            mark.to > originalFrom;

        if (!overlapsSelection) {

            if (mark.to <= from) {
                nextInserts.push({
                    from: mark.from,
                    to: mark.to
                });
            } else if (mark.from >= to) {
                nextInserts.push({
                    from:
                        mark.from - deletedLength,
                    to:
                        mark.to - deletedLength
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
                from: from,
                to:
                    mark.to - deletedLength
            });
        }
    }

    const nextDeletes =
        review.deletes.map(mark => ({
            from:
                mark.from >= to
                    ? mark.from - deletedLength
                    : mark.from,
            text: mark.text
        }));

    cm.dispatch({
        changes: {
            from,
            to,
            insert: ""
        },
        effects:
            internalChange.of()
    });

    cm.dispatch({
        effects:
            setReviewState.of({
                enabled: review.enabled,
                baseText: review.baseText,
                inserts: nextInserts,
                deletes: nextDeletes
            })
    });

    this.saveCurrentState(cm);

    new Notice("Добавление отменено");
    return;
}

    if (selected.type === "delete") {

        cm.dispatch({
            effects:
                rejectChange.of({
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
            effects:
                internalChange.of()
        });

        cm.dispatch({
            effects:
                acceptChange.of({
                    type: "insert",
                    from: selected.from,
                    to: selected.from + selected.text.length
                })
        });

        this.saveCurrentState(cm);

        new Notice("Удаление отменено");
    }
}

    onunload() {
        console.log("Review plugin unloaded");
    }
}