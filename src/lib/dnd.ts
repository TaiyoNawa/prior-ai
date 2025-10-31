import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

/**
 * ドラッグ操作の開始距離をまとめて管理する。値を小さくすると軽くつまめるが、誤操作が増える。
 * UIの「重さ」を調整したい場合はこの値を変更してください。
 */
export const DRAG_ACTIVATION_DISTANCE_PX = 4;

/**
 * ドラッグ中のアイテムを前面に出すための z-index を一元管理します。
 * プロジェクト内でドラッグアイテムの重なり順を調整したい場合はここを変更してください。
 */
export const DRAG_ITEM_Z_INDEX = 9999;

/**
 * タスク/サブタスク/インプットフォームで共通利用するソートセンサー。
 * ここを触ればドラッグ方式やキーボード挙動をまとめて調整できる。
 */
export function useStandardSortableSensors() {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: DRAG_ACTIVATION_DISTANCE_PX,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
}
