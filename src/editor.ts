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
                            const last =
                                state.inserts[
                                    state.inserts.length - 1
                                ];

                            if (
                                last &&
                                last.to === fromB
                            ) {
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

                            if (!removedWasInsert) {
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
