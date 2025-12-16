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
		onDrop?: (dragData: DragData, dropIndex?: number) => void;
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

				onDrop?.(dragData);
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
		items: Array<{ id: string; uniqueKey?: string | number; [key: string]: any }>;
		onSort: (fromIndex: number, toIndex: number) => void;
		disabled?: boolean;
		handle?: string; // CSS selector for drag handle
		onDrop?: (dragData: DragData, dropIndex: number) => void;
		acceptTypes?: string[];
	}
> = (node, params) => {
	let { items, onSort, disabled = false, handle, onDrop, acceptTypes } = params || {};
	let draggedElement: HTMLElement | null = null;
	let draggedIndex: number = -1;
	let placeholder: HTMLElement | null = null;
	let isInternalDrag: boolean = false;

	function getItemElement(target: EventTarget | null): HTMLElement | null {
		if (!target || !(target instanceof HTMLElement)) return null;

		// Find the closest item element
		return target.closest("[data-sortable-item]");
	}

	function getItemIndex(element: HTMLElement): number {
		// Get the sortable key from the element
		const sortableKey = element.getAttribute("data-sortable-item");
		if (!sortableKey) return -1;

		// Find the index in the items array
		return items.findIndex((item) => {
			const key = item.uniqueKey !== undefined ? String(item.uniqueKey) : item.id;
			return key === sortableKey;
		});
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

		isInternalDrag = true;
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/html", draggedElement.innerHTML);

		// Create placeholder
		placeholder = createPlaceholder(draggedElement);
		draggedElement.classList.add("dragging");
	}

	function handleDragOver(e: DragEvent) {
		if (disabled) return;

		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = draggedElement ? "move" : "copy";
		}

		// Create placeholder for external drags if needed
		if (!isInternalDrag && !placeholder && e.dataTransfer) {
			// Check if this is an acceptable external drag
			try {
				const types = Array.from(e.dataTransfer.types);
				if (types.includes("application/json")) {
					// Create a generic placeholder for external drags
					placeholder = document.createElement("div");
					placeholder.className = "sortable-placeholder";
					placeholder.style.height = "60px"; // Default height for external items
				}
			} catch (err) {
				// Ignore errors when accessing dataTransfer
			}
		}

		// Show placeholder for both internal and external drags
		if (placeholder) {
			const afterElement = getDragAfterElement(node, e.clientY);
			if (afterElement == null) {
				node.appendChild(placeholder);
			} else {
				node.insertBefore(placeholder, afterElement);
			}
		}
	}

	function handleDrop(e: DragEvent) {
		if (disabled) return;

		e.preventDefault();

		// Handle internal sort
		if (isInternalDrag && draggedElement && placeholder) {
			// Find where to insert based on placeholder position
			const children = Array.from(node.children);
			const placeholderIndex = children.indexOf(placeholder);

			// Count actual items before placeholder (excluding the placeholder itself)
			let toIndex = 0;
			for (let i = 0; i < placeholderIndex; i++) {
				if (children[i] !== draggedElement && children[i].hasAttribute("data-sortable-item")) {
					toIndex++;
				}
			}

			if (draggedIndex !== -1 && draggedIndex !== toIndex) {
				onSort(draggedIndex, toIndex);
			}
		} else if (!isInternalDrag && e.dataTransfer && onDrop) {
			// Handle external drop
			try {
				const dragDataStr = e.dataTransfer.getData("application/json");
				if (dragDataStr) {
					const dragData = JSON.parse(dragDataStr) as DragData;

					// Check if we accept this type
					if (acceptTypes && !acceptTypes.includes(dragData.type)) {
						cleanup();
						return;
					}

					// Find drop position based on placeholder location
					const children = Array.from(node.children);
					let dropIndex = 0;

					for (let i = 0; i < children.length; i++) {
						if (children[i] === placeholder) {
							break;
						}
						if (children[i].hasAttribute("data-sortable-item")) {
							dropIndex++;
						}
					}

					onDrop(dragData, dropIndex);
				}
			} catch (err) {
				console.error("Failed to parse drag data:", err);
			}
		}

		cleanup();
	}

	function handleDragEnd() {
		cleanup();
	}

	function handleDragLeave(e: DragEvent) {
		if (disabled) return;

		// Check if we're really leaving the container
		const rect = node.getBoundingClientRect();
		const x = e.clientX;
		const y = e.clientY;

		if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
			// Clean up placeholder for external drags
			if (!isInternalDrag && placeholder) {
				placeholder.remove();
				placeholder = null;
			}
		}
	}

	function cleanup() {
		if (draggedElement) {
			draggedElement.classList.remove("dragging");
			draggedElement = null;
		}
		if (placeholder) {
			placeholder.remove();
			placeholder = null;
		}
		draggedIndex = -1;
		isInternalDrag = false;
	}

	function getDragAfterElement(container: HTMLElement, y: number): HTMLElement | null {
		const draggableElements = Array.from(container.querySelectorAll("[data-sortable-item]")).filter(
			(el) => el !== draggedElement && el !== placeholder
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
		const itemElements = Array.from(node.querySelectorAll("[data-sortable-item]"));
		itemElements.forEach((element) => {
			if (element instanceof HTMLElement) {
				element.draggable = !disabled;
			}
		});

		if (!disabled) {
			node.addEventListener("dragstart", handleDragStart);
			node.addEventListener("dragover", handleDragOver);
			node.addEventListener("drop", handleDrop);
			node.addEventListener("dragend", handleDragEnd);
			node.addEventListener("dragleave", handleDragLeave);
		}
	}

	function teardown() {
		node.removeEventListener("dragstart", handleDragStart);
		node.removeEventListener("dragover", handleDragOver);
		node.removeEventListener("drop", handleDrop);
		node.removeEventListener("dragend", handleDragEnd);
		node.removeEventListener("dragleave", handleDragLeave);
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
			onDrop = newParams?.onDrop || onDrop;
			acceptTypes = newParams?.acceptTypes || acceptTypes;
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
