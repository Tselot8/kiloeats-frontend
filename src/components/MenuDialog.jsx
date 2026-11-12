import { useEffect, useId, useRef } from "react";

const MenuDialog = ({ title, children, onDismiss, busy }) => {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    dialog.querySelector("[data-initial-focus]")?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
      else document.querySelector(".addFood, .back-to-menu")?.focus();
    };
  }, []);

  useEffect(() => {
    if (busy) dialogRef.current?.focus();
  }, [busy]);

  const containFocus = (event) => {
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    const controls = Array.from(dialog.querySelectorAll('button, input, textarea, select, a[href], [tabindex]'))
      .filter((element) => !element.matches(":disabled") && element.tabIndex >= 0 && element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); dialog.focus(); return; }
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !controls.includes(active))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (active === last || !controls.includes(active))) {
      event.preventDefault(); first.focus();
    }
  };

  return (
    <dialog ref={dialogRef} className="menu-dialog" aria-labelledby={titleId} tabIndex={-1} onKeyDown={containFocus}
      onCancel={(event) => { event.preventDefault(); if (!busy) onDismiss(); }}>
      <div className="menu-dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="button-secondary dialog-close" aria-label="Close dialog" onClick={onDismiss} disabled={busy}>×</button>
      </div>
      {children}
    </dialog>
  );
};

MenuDialog.propTypes = {
  title: (props) => typeof props.title !== "string" ? new Error("MenuDialog requires a title.") : null,
  children: (props) => props.children == null ? new Error("MenuDialog requires content.") : null,
  onDismiss: (props) => typeof props.onDismiss !== "function" ? new Error("MenuDialog requires onDismiss.") : null,
  busy: (props) => typeof props.busy !== "boolean" ? new Error("MenuDialog requires a busy state.") : null,
};

export default MenuDialog;
