import { ref, onMounted, onUnmounted, type Ref } from "vue";

export function useScrollDrag(refElement: Ref<HTMLElement | null>) {
  const isDown = ref(false);
  const startX = ref(0);
  const scrollLeft = ref(0);

  function mouseDown(event: MouseEvent) {
    console.log("scrollDrag mousedown");
    if (!refElement.value) return;
    isDown.value = true;
    startX.value = event.pageX - refElement.value.offsetLeft;
    scrollLeft.value = refElement.value.scrollLeft;
  }

  function mouseDownOff() {
    isDown.value = false;
  }

  function mouseMove(event: MouseEvent) {
    if (!isDown.value || !refElement.value) return;
    event.preventDefault();
    const x = event.pageX - refElement.value.offsetLeft;
    const walk = (x - startX.value) * 3;
    refElement.value.scrollLeft = scrollLeft.value - walk;
  }

  // onMounted(() => {
    if (!refElement.value) return;
    refElement.value.addEventListener("mousedown", mouseDown);
    refElement.value.addEventListener("mouseleave", mouseDownOff);
    refElement.value.addEventListener("mouseup", mouseDownOff);
    refElement.value.addEventListener("mousemove", mouseMove);
  // });

  onUnmounted(() => {
    if (!refElement.value) return;
    refElement.value.removeEventListener("mousedown", mouseDown);
    refElement.value.removeEventListener("mouseleave", mouseDownOff);
    refElement.value.removeEventListener("mouseup", mouseDownOff);
    refElement.value.removeEventListener("mousemove", mouseMove);
  });
}
