import type { Ref } from "vue";

const isScrollable = (element: HTMLElement) => {
  const { overflowY } = getComputedStyle(element);
  return overflowY === "auto" || overflowY === "scroll";
};

const findScrollParent = (element: HTMLElement): HTMLElement | null => {
  let node = element.parentElement;
  while (node) {
    if (isScrollable(node)) return node;
    node = node.parentElement;
  }
  return (document.scrollingElement as HTMLElement | null) ?? null;
};

/**
 * The page scrolls inside the dashboard panel body, not the window, so a
 * virtualiser has to be pointed at whichever ancestor actually scrolls and told
 * how far down that ancestor's content the virtualised list begins.
 */
export function useScrollParent(target: Ref<HTMLElement | null>) {
  const scrollElement = shallowRef<HTMLElement | null>(null);
  const scrollMargin = ref(0);

  const measure = () => {
    const element = target.value;
    const parent = scrollElement.value;
    if (!element || !parent) return;
    const top = element.getBoundingClientRect().top;
    scrollMargin.value =
      parent === document.scrollingElement
        ? top + parent.scrollTop
        : top - parent.getBoundingClientRect().top + parent.scrollTop;
  };

  let observer: ResizeObserver | undefined;

  onMounted(() => {
    const element = target.value;
    if (!element) return;
    scrollElement.value = findScrollParent(element);
    measure();

    observer = new ResizeObserver(measure);
    observer.observe(element);
    if (scrollElement.value) observer.observe(scrollElement.value);
    window.addEventListener("resize", measure);
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    window.removeEventListener("resize", measure);
  });

  return { scrollElement, scrollMargin, measure };
}
