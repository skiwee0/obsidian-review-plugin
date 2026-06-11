import {
    ChangeSet,
    RangeSetBuilder,
    StateEffect,
    StateField
} from "@codemirror/state";

import {
    Decoration,
    DecorationSet,
    EditorView,
    WidgetType
} from "@codemirror/view";

export interface InsertMark {
    from: number;
    to: number;
}

export interface DeleteMark {
    from: number;
    text: string;
}

export interface ReviewData {
    enabled: boolean;
    baseText: string;
    inserts: InsertMark[];
    deletes: DeleteMark[];
}

export const setReviewState =
    StateEffect.define<ReviewData>();

export const setReviewEnabled =
    StateEffect.define<boolean>();

    export const setBaseText =
    StateEffect.define<string>();

export const acceptAllChanges =
    StateEffect.define<void>();

export const rejectAllChanges =
    StateEffect.define<void>();

export const acceptChange =
    StateEffect.define<{
        from: number;
        to: number;
        type: "insert" | "delete";
    }>();

export const rejectChange =
    StateEffect.define<{
        from: number;
        to: number;
        type: "insert" | "delete";
    }>();

export const internalChange =
    StateEffect.define<void>();

const insertDecoration =
    Decoration.mark({
        class: "review-insert"
    });

    const insertCellDecoration =
    Decoration.mark({
        class: "review-insert review-table-cell"
    });

function rangesOverlap(
    from1: number,
    to1: number,
    from2: number,
    to2: number
) {
    return from1 < to2 && to1 > from2;
}

function getTableCellRanges(
    text: string
): { from: number; to: number }[] {

    const result: { from: number; to: number }[] = [];

    let lineStart = 0;

    for (const line of text.split("\n")) {

        if (line.includes("|")) {

            const pipeIndexes: number[] = [];

            for (let i = 0; i < line.length; i++) {
                if (line[i] === "|") {
                    pipeIndexes.push(i);
                }
            }

            if (pipeIndexes.length >= 2) {

                for (let i = 0; i < pipeIndexes.length - 1; i++) {

                    let from =
                        lineStart + pipeIndexes[i] + 1;

                    let to =
                        lineStart + pipeIndexes[i + 1];

                    while (
                        from < to &&
                        text[from] === " "
                    ) {
                        from++;
                    }

                    while (
                        to > from &&
                        text[to - 1] === " "
                    ) {
                        to--;
                    }

                    if (from < to) {
                        result.push({
                            from,
                            to
                        });
                    }
                }
            }
        }

        lineStart +=
            line.length + 1;
    }

    return result;
}

class DeletedTextWidget extends WidgetType {

    constructor(
        private text: string
    ) {
        super();
    }

    toDOM() {
        const span =
            document.createElement("span");

        span.className =
            "review-delete";

        span.textContent =
            this.text;

        return span;
    }
}

function mapInsertMarks(
    inserts: InsertMark[],
    changes: ChangeSet,
    oldDocLength: number
): InsertMark[] {

    return inserts
        .filter(mark =>
            mark.from >= 0 &&
            mark.to >= mark.from &&
            mark.to <= oldDocLength
        )
        .map(mark => ({
            from: changes.mapPos(mark.from),
            to: changes.mapPos(mark.to)
        }))
        .filter(mark =>
            mark.from >= 0 &&
            mark.to >= mark.from
        );
}

function mapDeleteMarks(
    deletes: DeleteMark[],
    changes: ChangeSet,
    oldDocLength: number
): DeleteMark[] {

    return deletes
        .filter(mark =>
            mark.from >= 0 &&
            mark.from <= oldDocLength
        )
        .map(mark => ({
            from: changes.mapPos(mark.from),
            text: mark.text
        }))
        .filter(mark =>
            mark.from >= 0
        );
}

function sanitizeReviewData(
    data: ReviewData,
    docLength: number
): ReviewData {

    return {
        enabled: data.enabled,
        baseText: data.baseText ?? "",
        inserts: data.inserts.filter(mark =>
            mark.from >= 0 &&
            mark.to >= mark.from &&
            mark.to <= docLength
        ),
        deletes: data.deletes.filter(mark =>
            mark.from >= 0 &&
            mark.from <= docLength
        )
    };
}

export const reviewState =
    StateField.define<ReviewData>({

        create() {
            return {
                enabled: false,
                baseText: "",
                inserts: [],
                deletes: []
            };
        },

        update(value, tr) {

            let state: ReviewData = {
                enabled: value.enabled,
                baseText: value.baseText,
                inserts: [...value.inserts],
                deletes: [...value.deletes]
            };

            const isInternal =
                tr.effects.some(effect =>
                    effect.is(internalChange)
                );

            const isRejectAll =
                tr.effects.some(effect =>
                    effect.is(rejectAllChanges)
                );

            const oldInserts =
                [...state.inserts];

            if (
    tr.docChanged &&
    !isRejectAll &&
    state.enabled
) {
                const oldDocLength =
                    tr.startState.doc.length;

                state.inserts =
                    mapInsertMarks(
                        state.inserts,
                        tr.changes,
                        oldDocLength
                    );

                state.deletes =
                    mapDeleteMarks(
                        state.deletes,
                        tr.changes,
                        oldDocLength
                    );
            }

            for (const effect of tr.effects) {

                if (effect.is(setReviewState)) {
                    state =
                        sanitizeReviewData(
                            effect.value,
                            tr.state.doc.length
                        );
                }

                if (effect.is(setReviewEnabled)) {
                    state.enabled =
                        effect.value;
                }

                if (effect.is(setBaseText)) {
    state.baseText =
        effect.value;
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
                    const change =
                        effect.value;

                    if (change.type === "insert") {
    const newInserts: InsertMark[] = [];

    for (const mark of state.inserts) {

        const overlaps =
            mark.from < change.to &&
            mark.to > change.from;

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
                        state.deletes =
                            state.deletes.filter(mark =>
                                Math.abs(mark.from - change.from) > 2
                            );
                    }
                }

                if (effect.is(rejectChange)) {
                    const change =
                        effect.value;

                    if (change.type === "insert") {
    const newInserts: InsertMark[] = [];

    for (const mark of state.inserts) {

        const overlaps =
            mark.from < change.to &&
            mark.to > change.from;

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
                        state.deletes =
                            state.deletes.filter(mark =>
                                Math.abs(mark.from - change.from) > 2
                            );
                    }
                }
            }

if (
    state.enabled &&
    tr.docChanged &&
    !isInternal &&
    !isRejectAll
) {
                tr.changes.iterChanges(
                    (
                        fromA,
                        toA,
                        fromB,
                        toB,
                        inserted
                    ) => {

                        const insertedLength =
                            toB - fromB;

                        const removedLength =
                            toA - fromA;

                        if (insertedLength > 0) {

    const insertedText =
        inserted.toString();

    const last =
        state.inserts[
            state.inserts.length - 1
        ];

    const shouldMerge =
        last &&
        last.to === fromB &&
        !insertedText.includes("\n") &&
        !insertedText.includes("|");

    if (shouldMerge) {
        last.to = toB;
    } else {
        state.inserts.push({
            from: fromB,
            to: toB
        });
    }
}

                        if (removedLength > 0) {
    const removedWasInsert =
        oldInserts.some(mark =>
            fromA >= mark.from &&
            toA <= mark.to
        );

    if (removedWasInsert) {
    state.inserts =
        state.inserts.filter(mark =>
            mark.to > mark.from
        );
} else {
        const removedText =
            tr.startState.doc.sliceString(
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

export const reviewDecorations =
    StateField.define<DecorationSet>({

        create() {
            return Decoration.none;
        },

        update(_, tr) {

            const review =
                tr.state.field(reviewState);

            const builder =
                new RangeSetBuilder<Decoration>();

            const items: {
                from: number;
                to: number;
                decoration: Decoration;
            }[] = [];

            const docText =
    tr.state.doc.toString();

const tableCells =
    getTableCellRanges(docText);

for (const mark of review.inserts) {

    items.push({
        from: mark.from,
        to: mark.to,
        decoration:
            insertDecoration
    });

    const affectedCells =
        tableCells.filter(cell =>
            rangesOverlap(
                mark.from,
                mark.to,
                cell.from,
                cell.to
            )
        );

    for (const cell of affectedCells) {
        items.push({
            from: Math.max(
                cell.from,
                mark.from
            ),
            to: Math.min(
                cell.to,
                mark.to
            ),
            decoration:
                insertCellDecoration
        });
    }
}

            for (const mark of review.deletes) {
                items.push({
                    from: mark.from,
                    to: mark.from,
                    decoration:
                        Decoration.widget({
                            widget:
                                new DeletedTextWidget(
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
                } catch {
                    // Игнорируем битые позиции, чтобы редактор не падал.
                }
            }

            return builder.finish();
        },

        provide: field =>
            EditorView.decorations.from(field)
    });
