import Modal from "./Modal";
import { Ring } from "../fr";
import { useGame } from "../../store";
import { EXTRA_MENUS } from "../hud/ActionBar";
import { RAIL } from "../hud/LeftRail";

export default function MorePanel() {
  const open = useGame((s) => s.openModal);
  const items = [...RAIL, ...EXTRA_MENUS];
  return (
    <Modal title="Menu" testid="more-modal" width={600}>
      <div className="grid grid-cols-5 gap-x-3 gap-y-4 py-2 justify-items-center">
        {items.map((m) => (
          <Ring key={m.id} img={m.img} label={m.label} size={54} dim testid={`more-${m.id}`}
            onClick={() => open({ type: "soon", title: m.title || m.label, desc: m.desc, phase: m.phase })} />
        ))}
        <Ring img="settings" label="Settings" size={54} testid="more-settings" onClick={() => open({ type: "settings" })} />
      </div>
    </Modal>
  );
}
