/**
 * Simple drag and drop utilities for Svelte using native HTML5 drag and drop
 */
import type { Action } from "svelte/action";

export interface DragData {
	id: string;
	type: string;
	data?: any;
}

/**
 * Svelte action for making an element draggable
 */
export const draggable: Action<
	HTMLElement,
	{
		dragData: DragData;
		disabled?: boolean;
		onDragStart?: (e: DragEvent) => void;
		onDragEnd?: (e: DragEvent) => void;
	}
> = (node, params) => {
	let { dragData, disabled = false, onDragStart, onDragEnd } = params || {};

	function handleDragStart(e: DragEvent) {
		if (disabled || !e.dataTransfer) return;

		e.dataTransfer.effectAllowed = "copyMove";
		e.dataTransfer.setData("application/json", JSON.stringify(dragData));
		node.classList.add("dragging");

		onDragStart?.(e);
	}

	function handleDragEnd(e: DragEvent) {
		node.classList.remove("dragging");
		onDragEnd?.(e);
	}

	function setup() {
		node.draggable = !disabled;
		if (!disabled) {
			node.addEventListener("dragstart", handleDragStart);
			node.addEventListener("dragend", handleDragEnd);
		}
	}

	function teardown() {
		node.removeEventListener("dragstart", handleDragStart);
		node.removeEventListener("dragend", handleDragEnd);
	}

	setup();

	return {
		update(newParams) {
			teardown();
			dragData = newParams?.dragData || dragData;
			disabled = newParams?.disabled ?? disabled;
			onDragStart = newParams?.onDragStart || onDragStart;
			onDragEnd = newParams?.onDragEnd || onDragEnd;
			setup();
		},
		destroy() {
			teardown();
		},
	};
};

/**
 * Svelte action for making an element a drop zone
 */
export const dropzone: Action<
	HTMLElement,
	{
		onDrop?: (dragData: DragData, e: DragEvent) => void;
		onDragOver?: (e: DragEvent) => void;
		onDragLeave?: (e: DragEvent) => void;
		onDragEnter?: (e: DragEvent) => void;
		disabled?: boolean;
		acceptTypes?: string[];
	}
> = (node, params) => {
	let {
		onDrop,
		onDragOver,
		onDragLeave,
		onDragEnter,
		disabled = false,
		acceptTypes,
	} = params || {};

	function handleDragOver(e: DragEvent) {
		if (disabled) return;

		e.preventDefault();

		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = "copy";
		}

		if (!node.classList.contains("drag-over")) {
			node.classList.add("drag-over");
		}

		onDragOver?.(e);
	}

	function handleDragEnter(e: DragEvent) {
		if (disabled) return;

		e.preventDefault();
		onDragEnter?.(e);
	}

	function handleDragLeave(e: DragEvent) {
		if (disabled) return;

		// Check if we're leaving the entire drop zone
		const rect = node.getBoundingClientRect();
		const x = e.clientX;
		const y = e.clientY;

		if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
			node.classList.remove("drag-over");
			onDragLeave?.(e);
		}
	}

	function handleDrop(e: DragEvent) {
		if (disabled || !e.dataTransfer) return;

		e.preventDefault();
		node.classList.remove("drag-over");

		try {
			const dragDataStr = e.dataTransfer.getData("application/json");
			if (dragDataStr) {
				const dragData = JSON.parse(dragDataStr) as DragData;

				// Check if we accept this type
				if (acceptTypes && !acceptTypes.includes(dragData.type)) {
					return;
				}

				onDrop?.(dragData, e);
			}
		} catch (err) {
			console.error("Failed to parse drag data:", err);
		}
	}

	function setup() {
		if (!disabled) {
			node.addEventListener("dragover", handleDragOver);
			node.addEventListener("dragenter", handleDragEnter);
			node.addEventListener("dragleave", handleDragLeave);
			node.addEventListener("drop", handleDrop);
		}
	}

	function teardown() {
		node.removeEventListener("dragover", handleDragOver);
		node.removeEventListener("dragenter", handleDragEnter);
		node.removeEventListener("dragleave", handleDragLeave);
		node.removeEventListener("drop", handleDrop);
		node.classList.remove("drag-over");
	}

	setup();

	return {
		update(newParams) {
			teardown();
			onDrop = newParams?.onDrop || onDrop;
			onDragOver = newParams?.onDragOver || onDragOver;
			onDragLeave = newParams?.onDragLeave || onDragLeave;
			onDragEnter = newParams?.onDragEnter || onDragEnter;
			disabled = newParams?.disabled ?? disabled;
			acceptTypes = newParams?.acceptTypes || acceptTypes;
			setup();
		},
		destroy() {
			teardown();
		},
	};
};

/**
 * Svelte action for sortable lists
 */
export const sortable: Action<
	HTMLElement,
	{
		items: Array<{ id: string; [key: string]: any }>;
		onSort: (fromIndex: number, toIndex: number) => void;
		disabled?: boolean;
		handle?: string; // CSS selector for drag handle
	}
> = (node, params) => {
	let { items, onSort, disabled = false, handle } = params || {};
	let draggedElement: HTMLElement | null = null;
	let draggedIndex: number = -1;
	let placeholder: HTMLElement | null = null;

	function getItemElement(target: EventTarget | null): HTMLElement | null {
		if (!target || !(target instanceof HTMLElement)) return null;

		// Find the closest item element
		return target.closest("[data-sortable-item]");
	}

	function getItemIndex(element: HTMLElement): number {
		const itemElements = Array.from(node.querySelectorAll("[data-sortable-item]"));
		return itemElements.indexOf(element);
	}

	function createPlaceholder(element: HTMLElement): HTMLElement {
		const rect = element.getBoundingClientRect();
		const ph = document.createElement("div");
		ph.className = "sortable-placeholder";
		ph.style.height = `${rect.height}px`;
		ph.style.width = `${rect.width}px`;
		return ph;
	}

	function handleDragStart(e: DragEvent) {
		if (disabled || !e.dataTransfer) return;

		const target = e.target;
		if (!target || !(target instanceof HTMLElement)) return;

		// Check if we're dragging from handle
		if (handle) {
			const handleElement = target.closest(handle);
			if (!handleElement) return;
		}

		draggedElement = getItemElement(target);
		if (!draggedElement) return;

		draggedIndex = getItemIndex(draggedElement);
		if (draggedIndex === -1) return;

		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/html", draggedElement.innerHTML);

		// Create and insert placeholder
		placeholder = createPlaceholder(draggedElement);
		draggedElement.style.opacity = "0.5";
	}

	function handleDragOver(e: DragEvent) {
		if (disabled || !draggedElement || !placeholder) return;

		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = "move";
		}

		const afterElement = getDragAfterElement(node, e.clientY);
		if (afterElement == null) {
			node.appendChild(placeholder);
		} else {
			node.insertBefore(placeholder, afterElement);
		}
	}

	function handleDrop(e: DragEvent) {
		if (disabled || !draggedElement || !placeholder) return;

		e.preventDefault();

		const placeholderIndex = getItemIndex(placeholder);

		if (draggedIndex !== -1 && placeholderIndex !== -1 && draggedIndex !== placeholderIndex) {
			onSort(draggedIndex, placeholderIndex);
		}

		cleanup();
	}

	function handleDragEnd() {
		cleanup();
	}

	function cleanup() {
		if (draggedElement) {
			draggedElement.style.opacity = "";
			draggedElement = null;
		}
		if (placeholder) {
			placeholder.remove();
			placeholder = null;
		}
		draggedIndex = -1;
	}

	function getDragAfterElement(container: HTMLElement, y: number): HTMLElement | null {
		const draggableElements = Array.from(
			container.querySelectorAll("[data-sortable-item]:not(.dragging)")
		) as HTMLElement[];

		return draggableElements.reduce<{ offset: number; element: HTMLElement | null }>(
			(closest, child) => {
				const box = child.getBoundingClientRect();
				const offset = y - box.top - box.height / 2;

				if (offset < 0 && offset > closest.offset) {
					return { offset: offset, element: child };
				} else {
					return closest;
				}
			},
			{ offset: Number.NEGATIVE_INFINITY, element: null }
		).element;
	}

	function setup() {
		// Add sortable item attributes to children
		items.forEach((item, index) => {
			const element = node.children[index] as HTMLElement;
			if (element) {
				element.setAttribute("data-sortable-item", item.id);
				element.draggable = !disabled;
			}
		});

		if (!disabled) {
			node.addEventListener("dragstart", handleDragStart);
			node.addEventListener("dragover", handleDragOver);
			node.addEventListener("drop", handleDrop);
			node.addEventListener("dragend", handleDragEnd);
		}
	}

	function teardown() {
		node.removeEventListener("dragstart", handleDragStart);
		node.removeEventListener("dragover", handleDragOver);
		node.removeEventListener("drop", handleDrop);
		node.removeEventListener("dragend", handleDragEnd);
		cleanup();
	}

	setup();

	return {
		update(newParams) {
			teardown();
			items = newParams?.items || items;
			onSort = newParams?.onSort || onSort;
			disabled = newParams?.disabled ?? disabled;
			handle = newParams?.handle || handle;
			setup();
		},
		destroy() {
			teardown();
		},
	};
};

/**
 * Helper to move an array item from one position to another
 */
export function arrayMove<T>(array: T[], from: number, to: number): T[] {
	const newArray = array.slice();
	const [removed] = newArray.splice(from, 1);
	newArray.splice(to, 0, removed);
	return newArray;
}
