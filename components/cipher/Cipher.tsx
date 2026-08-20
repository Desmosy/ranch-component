"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { cn } from "@/lib/utils";
import {
  PITCH,
  easeInOutQuart,
  makeResolve,
  makeScramble,
  move,
  onLayer,
  snap,
  turnCoords,
  invert,
  type Cubie,
} from "./cube";
import { GLYPH_ORDER, paintFragment, paintGlyph, paintGlyphLines } from "./glyphs";

const FIELD = "#0A0A0A";
const BODY = "#2B4FE8";
const CITRON = "#F2D53C";
const AZURE = "#4A6BF5";
const BONE = "#FFFFFF";
const MARK = "#E9E6DE";

const TURN_MS = 340;
const GAP_MS = 70;
const PAUSE_MS = 600;
const HOLD_MS = 2800;
const TUMBLE_RATE = (7 * Math.PI) / 180;

type Phase = "scramble" | "pause" | "resolve" | "hold";

export interface CipherProps {
  className?: string;
  /** Which letter to start on. */
  start?: number;
  /**
   * "auto" runs the scramble → resolve → hold cycle on its own clock.
   * "scroll" hands the timeline to `progress` instead: 0 is fully scrambled,
   * 1 lands the letter. Scrubbing is only possible because the resolve is a
   * recorded move list rather than a search — every move has an exact inverse,
   * so the sequence runs backwards for free.
   */
  mode?: "auto" | "scroll";
  /** 0..1, only read in scroll mode. */
  progress?: number;
  /** How many letters the scroll timeline passes through. */
  letters?: number;
  /**
   * "plastic" is the moulded object. "line" is the same cube with every
   * surface reduced to its outline — no fills, no material model, no lights.
   * The logic underneath is identical; only what gets hung on each cubie
   * changes, which is the payoff of keeping state and presentation apart.
   */
  variant?: "plastic" | "line";
}

export default function Cipher({
  className,
  start = 0,
  mode = "auto",
  progress = 0,
  letters = 3,
  variant = "plastic",
}: CipherProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const progressRef = useRef(progress);
  // Written every scroll event, read once a frame. Routing a scrub value
  // through React state would reconcile the tree at scroll frequency to move
  // one number.
  progressRef.current = progress;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Context creation is the one step here that fails for reasons outside the
    // code — no WebGL, a lost context, a blocked GPU — and it fails by handing
    // back something unusable rather than by throwing anything readable. Say so
    // plainly instead of leaving an empty plate on screen.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      if (!renderer.getContext()) throw new Error("WebGL context was not created");
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err);
      setFailure(`WebGL unavailable — ${why}`);
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0.4, 9.6);
    camera.lookAt(0, 0, 0);

    // Procedural room rather than an HDRI file — the clearcoat only needs
    // something plausible to reflect, and this ships no asset.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.42;

    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(4.2, 5.4, 4.8);
    scene.add(key);
    // Against a black field the hemisphere can no longer bounce the background
    // in — it would bounce nothing. A cool dim sky keeps the shadow side of the
    // plastic from going to solid black and losing the object's silhouette.
    scene.add(new THREE.HemisphereLight(0x5b6478, 0x14161c, 0.55));

    // --- materials, shared across every cubie ------------------------------
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(BODY),
      roughness: 0.35,
      clearcoat: 0.6,
      clearcoatRoughness: 0.25,
    });
    const stickerMat = (map: THREE.Texture | null, color: string) =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(map ? "#ffffff" : color),
        map,
        roughness: 0.22,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      });

    const line = variant === "line";
    const LINE_COLOR = new THREE.Color(MARK);
    const lineMat = new THREE.LineBasicMaterial({ color: LINE_COLOR });
    // A rounded box has no clean silhouette to extract, so the line cut takes
    // its edges from a plain box — the corner radius exists to catch light,
    // and there is no light here.
    const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.96, 0.96, 0.96));

    const bodyGeo = new RoundedBoxGeometry(1, 1, 1, 4, 0.12);

    const S_SIZE = 0.82;
    const stickerShape = (() => {
      const s = S_SIZE;
      const r = 0.1;
      const half = s / 2;
      const shape = new THREE.Shape();
      shape.moveTo(-half + r, -half);
      shape.lineTo(half - r, -half);
      shape.quadraticCurveTo(half, -half, half, -half + r);
      shape.lineTo(half, half - r);
      shape.quadraticCurveTo(half, half, half - r, half);
      shape.lineTo(-half + r, half);
      shape.quadraticCurveTo(-half, half, -half, half - r);
      shape.lineTo(-half, -half + r);
      shape.quadraticCurveTo(-half, -half, -half + r, -half);
      return shape;
    })();

    /** A rounded square with UVs remapped to 0..1 across its own bounds. */
    const stickerGeo = (() => {
      const s = S_SIZE;
      const half = s / 2;
      const geo = new THREE.ShapeGeometry(stickerShape, 12);
      const p = geo.attributes.position;
      const uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        uv[i * 2] = (p.getX(i) + half) / s;
        uv[i * 2 + 1] = (p.getY(i) + half) / s;
      }
      geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      return geo;
    })();

    /** The sticker's rounded square as a closed polyline. */
    const stickerOutline = (() => {
      const geo = new THREE.BufferGeometry();
      const pts = stickerShape.getPoints(48);
      const arr = new Float32Array(pts.length * 3);
      for (let i = 0; i < pts.length; i++) {
        arr[i * 3] = pts[i].x;
        arr[i * 3 + 1] = pts[i].y;
        arr[i * 3 + 2] = 0;
      }
      geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      return geo;
    })();
    const glyphPlane = new THREE.PlaneGeometry(0.82, 0.82);

    const textures: THREE.Texture[] = [];
    const pixelate = (t: THREE.Texture) => {
      // Mandatory (§3.1). Linear filtering turns crisp pixel edges to mush and
      // the whole aesthetic goes with them.
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      textures.push(t);
      return t;
    };

    let glyphIndex = start % GLYPH_ORDER.length;
    const atlas = new THREE.CanvasTexture(paintGlyph(GLYPH_ORDER[glyphIndex]));
    pixelate(atlas);
    const lineAtlas = new THREE.CanvasTexture(paintGlyphLines(GLYPH_ORDER[glyphIndex], MARK));
    pixelate(lineAtlas);

    const cube = new THREE.Group();
    scene.add(cube);

    const cubies: Cubie[] = [];
    const glyphMats: THREE.MeshPhysicalMaterial[] = [];

    let fragIndex = 0;
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (!x && !y && !z) continue;
          const obj = new THREE.Group();
          obj.position.set(x * PITCH, y * PITCH, z * PITCH);
          obj.add(line ? new THREE.LineSegments(edgeGeo, lineMat) : new THREE.Mesh(bodyGeo, bodyMat));

          const faces: Array<[THREE.Vector3, THREE.Euler, string]> = [
            [new THREE.Vector3(0, 1, 0), new THREE.Euler(-Math.PI / 2, 0, 0), "U"],
            [new THREE.Vector3(0, -1, 0), new THREE.Euler(Math.PI / 2, 0, 0), "D"],
            [new THREE.Vector3(1, 0, 0), new THREE.Euler(0, Math.PI / 2, 0), "R"],
            [new THREE.Vector3(-1, 0, 0), new THREE.Euler(0, -Math.PI / 2, 0), "L"],
            [new THREE.Vector3(0, 0, 1), new THREE.Euler(0, 0, 0), "F"],
            [new THREE.Vector3(0, 0, -1), new THREE.Euler(0, Math.PI, 0), "B"],
          ];

          for (const [n, rot, name] of faces) {
            const outward =
              (n.x !== 0 && x === n.x) || (n.y !== 0 && y === n.y) || (n.z !== 0 && z === n.z);
            if (!outward) continue;

            if (line) {
              // Sticker as an outline, plus the glyph as stroked art. Nothing
              // is filled, so the faces stay transparent and you read the far
              // side of the cube through the near side.
              const loop = new THREE.LineLoop(stickerOutline, lineMat);
              loop.position.copy(n).multiplyScalar(0.505);
              loop.rotation.copy(rot);
              obj.add(loop);

              if (name === "U") {
                const t = lineAtlas.clone();
                pixelate(t);
                t.repeat.set(1 / 3, 1 / 3);
                t.offset.set((x + 1) / 3, (1 - z) / 3);
                const art = new THREE.Mesh(
                  glyphPlane,
                  new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }),
                );
                art.position.copy(n).multiplyScalar(0.506);
                art.rotation.copy(rot);
                obj.add(art);
                glyphMats.push(art.material as unknown as THREE.MeshPhysicalMaterial);
              }
              continue;
            }

            let mat: THREE.MeshPhysicalMaterial;
            if (name === "U") {
              // The glyph is cut out of one atlas by UV offset, not nine files.
              const t = atlas.clone();
              pixelate(t);
              t.repeat.set(1 / 3, 1 / 3);
              // Seen from above, the face's columns run with +x and its rows
              // run with +z. Texture v is flipped, so the -z cubie takes the
              // top band of the bitmap: v offset 2/3, not 0.
              t.offset.set((x + 1) / 3, (1 - z) / 3);
              mat = stickerMat(t, CITRON);
              glyphMats.push(mat);
            } else if (name === "D") {
              mat = stickerMat(null, CITRON);
            } else if ((name === "F" || name === "B") && (x + y + z) % 2 === 0) {
              mat = stickerMat(pixelate(new THREE.CanvasTexture(paintFragment(fragIndex++))), AZURE);
            } else if (name === "F" || name === "B") {
              mat = stickerMat(null, AZURE);
            } else {
              mat = stickerMat(null, (x + z) % 2 === 0 ? AZURE : BONE);
            }

            const s = new THREE.Mesh(stickerGeo, mat);
            s.position.copy(n).multiplyScalar(0.505);
            s.rotation.copy(rot);
            obj.add(s);
          }

          cube.add(obj);
          cubies.push({ x, y, z, object: obj });
        }
      }
    }

    /** Repaint the glyph atlas in place — no meshes are rebuilt between cycles. */
    const setGlyph = (i: number) => {
      const canvas = line
        ? paintGlyphLines(GLYPH_ORDER[i], MARK)
        : paintGlyph(GLYPH_ORDER[i]);
      for (const mat of glyphMats) {
        const t = mat.map as THREE.CanvasTexture | null;
        if (!t) continue;
        t.image = canvas;
        t.needsUpdate = true;
      }
    };

    // --- the move queue ----------------------------------------------------
    const pivot = new THREE.Group();
    cube.add(pivot);

    let queue: string[] = [];
    let active: ReturnType<typeof move> | null = null;
    let activeCubies: Cubie[] = [];
    let moveT = 0;
    let gapT = 0;
    let phase: Phase = "scramble";
    let phaseT = 0;
    let scramble: string[] = [];

    const rng = () => Math.random();

    const beginMove = (notation: string) => {
      active = move(notation);
      activeCubies = cubies.filter((c) => onLayer(c, active!));
      // attach(), not add() — it preserves world transform, and that is the
      // entire trick that makes layer rotation work on a shared scene graph.
      for (const c of activeCubies) pivot.attach(c.object);
      moveT = 0;
    };

    const endMove = () => {
      if (!active) return;
      // Land the pivot on the exact quarter turn FIRST, then hand the cubies
      // back. attach() preserves world transform, so the order is the whole
      // point: zero the pivot before detaching and the turn is simply undone.
      pivot.rotation[active.axis] = active.dir * (Math.PI / 2);
      pivot.updateMatrixWorld(true);
      for (const c of activeCubies) {
        cube.attach(c.object);
        turnCoords(c, active);
        snap(c);
      }
      pivot.rotation.set(0, 0, 0);
      pivot.updateMatrixWorld(true);
      active = null;
      activeCubies = [];
    };

    /** Commit a move with no animation. Used to build and scrub the timeline. */
    const applyInstant = (notation: string) => {
      const m = move(notation);
      const layer = cubies.filter((c) => onLayer(c, m));
      for (const c of layer) pivot.attach(c.object);
      pivot.rotation[m.axis] = m.dir * (Math.PI / 2);
      pivot.updateMatrixWorld(true);
      for (const c of layer) {
        cube.attach(c.object);
        turnCoords(c, m);
        snap(c);
      }
      pivot.rotation.set(0, 0, 0);
      pivot.updateMatrixWorld(true);
    };

    const startCycle = () => {
      scramble = makeScramble(rng, 14);
      queue = scramble.slice();
      phase = "scramble";
      phaseT = 0;
    };

    // --- tumble ------------------------------------------------------------
    const tumbleAxis = new THREE.Vector3(0.3, 1, 0.15).normalize();
    const spin = new THREE.Quaternion();
    /**
     * The held orientation. Not square to camera — a face dead-on reads as a
     * diagram, and the specular streak across the top only exists at an angle.
     */
    const holdQuat = (() => {
      const q = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0.3, 0.72, 0.62).normalize(),
      );
      return q;
    })();

    // --- pointer orbit ------------------------------------------------------
    // The cube turns under the hand, not the camera. Moving the camera would
    // slide the object out from under the furniture, and the furniture only
    // works because it is registered to a fixed frame.
    const WORLD_X = new THREE.Vector3(1, 0, 0);
    const WORLD_Y = new THREE.Vector3(0, 1, 0);
    const qDrag = new THREE.Quaternion();
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let spinX = 0;
    let spinY = 0;

    const applySpin = (yaw: number, pitch: number) => {
      // Premultiply: the rotation is about the WORLD axes, so the cube turns
      // the way the hand expects rather than about its own tumbled frame.
      qDrag.setFromAxisAngle(WORLD_Y, yaw);
      cube.quaternion.premultiply(qDrag);
      qDrag.setFromAxisAngle(WORLD_X, pitch);
      cube.quaternion.premultiply(qDrag);
    };

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      spinX = 0;
      spinY = 0;
      host.setPointerCapture(e.pointerId);
    };
    const onDrag = (e: PointerEvent) => {
      if (!dragging) return;
      const yaw = (e.clientX - lastX) * 0.0085;
      const pitch = (e.clientY - lastY) * 0.0085;
      lastX = e.clientX;
      lastY = e.clientY;
      applySpin(yaw, pitch);
      spinX = yaw;
      spinY = pitch;
    };
    const onRelease = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (host.hasPointerCapture(e.pointerId)) host.releasePointerCapture(e.pointerId);
    };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Keep the whole cube in frame in a wide card as well as a tall one.
      camera.position.z = 9.6 * Math.max(1, 1.15 / camera.aspect);
      camera.updateProjectionMatrix();
    };

    resize();

    if (reduced) {
      // Solved, glyph presented, one frame, loop never started (§7).
      cube.quaternion.copy(holdQuat);
      renderer.render(scene, camera);
      const roStatic = new ResizeObserver(() => {
        resize();
        renderer.render(scene, camera);
      });
      roStatic.observe(host);
      return () => {
        roStatic.disconnect();
        renderer.dispose();
        host.removeChild(renderer.domElement);
      };
    }

    // --- scroll timeline ----------------------------------------------------
    /**
     * One flat move list for the whole scroll. Each letter contributes a
     * resolve (scrambled → solved) followed by a scramble (solved → scattered),
     * so scrolling down reads as: solve it, scatter it, solve the next one.
     *
     * The glyph is repainted at the scatter apex — the one moment the face is
     * unreadable — so the letter is never seen changing.
     */
    const timeline: string[] = [];
    const repaintAt: number[] = [];
    if (mode === "scroll") {
      for (let i = 0; i < letters; i++) {
        const scr = makeScramble(rng, 14);
        timeline.push(...makeResolve(scr));
        repaintAt.push(timeline.length + 7);
        timeline.push(...makeScramble(rng, 14));
      }
      // Start scrambled: apply the first segment's inverse so progress 0 is
      // disorder and progress 1 is the letter.
      for (let i = 13; i >= 0; i--) applyInstant(invert(timeline[i]));
    }

    /** Where the scrub currently stands, in whole moves. */
    let scrubbed = 0;
    /**
     * The scrub is followed, not tracked. A trackpad fling delivers a large
     * jump in one event, and applying it raw snaps a dozen turns through in a
     * frame; easing toward the target gives the cube mass and keeps every move
     * visible even when the hand is careless.
     */
    let smooth = 0;
    let partial: ReturnType<typeof move> | null = null;
    let partialCubies: Cubie[] = [];
    let paintedTo = 0;

    const clearPartial = () => {
      if (!partial) return;
      // Partial turns are never committed to the logical grid, so undoing one
      // is just zeroing the pivot and handing the cubies back.
      pivot.rotation.set(0, 0, 0);
      pivot.updateMatrixWorld(true);
      for (const c of partialCubies) {
        cube.attach(c.object);
        snap(c);
      }
      partial = null;
      partialCubies = [];
    };

    const scrubTo = (p: number) => {
      const f = Math.max(0, Math.min(1, p)) * timeline.length;
      const whole = Math.min(timeline.length - 1, Math.floor(f));
      const frac = Math.min(1, f - whole);

      clearPartial();
      while (scrubbed < whole) applyInstant(timeline[scrubbed++]);
      while (scrubbed > whole) applyInstant(invert(timeline[--scrubbed]));

      // Swap the letter while the face is scattered, not while it is legible.
      const target = repaintAt.filter((r) => r <= scrubbed).length;
      if (target !== paintedTo) {
        paintedTo = target;
        setGlyph((start + target) % GLYPH_ORDER.length);
      }

      if (frac > 0.001) {
        partial = move(timeline[whole]);
        partialCubies = cubies.filter((c) => onLayer(c, partial!));
        for (const c of partialCubies) pivot.attach(c.object);
        pivot.rotation[partial.axis] = easeInOutQuart(frac) * partial.dir * (Math.PI / 2);
      }
    };

    if (mode === "auto") startCycle();
    else {
      smooth = 0;
      scrubTo(0);
    }

    let raf = 0;
    let last = 0;
    let running = false;
    let onScreen = false;
    let hidden = document.hidden;

    const frame = (now: number) => {
      raf = 0;
      try {
        step(now);
      } catch (err) {
        // A throw inside rAF does not reach a React error boundary and would
        // otherwise repeat sixty times a second. Stop the loop, name the cause
        // on the plate, and re-throw once so the page-level handler logs it
        // with a real stack.
        running = false;
        const why = err instanceof Error ? err.message : String(err);
        setFailure(`Frame loop stopped — ${why}`);
        setTimeout(() => {
          throw err;
        });
        return;
      }
      if (running) raf = requestAnimationFrame(frame);
    };

    const step = (now: number) => {
      const dt = last ? Math.min(50, now - last) : 16;
      last = now;

      // Tumble, independent of the layer turns. The hand outranks both the
      // tumble and the hold — a piece that yanks itself back to a "correct"
      // orientation while you are still holding it feels broken, so the glyph
      // only presents itself once the throw has run down.
      const thrown = Math.abs(spinX) + Math.abs(spinY) > 0.0008;
      if (dragging) {
        // nothing: the pointer is driving
      } else if (thrown) {
        applySpin(spinX, spinY);
        const decay = Math.exp((-dt / 1000) * 2.4);
        spinX *= decay;
        spinY *= decay;
      } else if (mode === "auto" && phase === "hold") {
        cube.quaternion.slerp(holdQuat, 1 - Math.exp((-dt / 1000) * 3.2));
      } else {
        spin.setFromAxisAngle(tumbleAxis, TUMBLE_RATE * (dt / 1000));
        cube.quaternion.multiply(spin);
      }

      if (mode === "scroll") {
        smooth += (progressRef.current - smooth) * (1 - Math.exp((-dt / 1000) * 5.5));
        scrubTo(smooth);
      } else if (active) {
        moveT += dt;
        const t = Math.min(1, moveT / TURN_MS);
        pivot.rotation[active.axis] = easeInOutQuart(t) * active.dir * (Math.PI / 2);
        if (t >= 1) {
          endMove();
          gapT = GAP_MS;
        }
      } else if (gapT > 0) {
        // The pause between turns. Back-to-back moves read as a machine; the
        // hesitation is what suggests deliberation.
        gapT -= dt;
      } else if (queue.length) {
        beginMove(queue.shift()!);
      } else {
        phaseT += dt;
        if (phase === "scramble") {
          phase = "pause";
          phaseT = 0;
        } else if (phase === "pause" && phaseT > PAUSE_MS) {
          queue = makeResolve(scramble);
          phase = "resolve";
          phaseT = 0;
        } else if (phase === "resolve") {
          phase = "hold";
          phaseT = 0;
        } else if (phase === "hold" && phaseT > HOLD_MS) {
          glyphIndex = (glyphIndex + 1) % GLYPH_ORDER.length;
          setGlyph(glyphIndex);
          startCycle();
        }
      }

      renderer.render(scene, camera);
    };

    const sync = () => {
      const should = onScreen && !hidden;
      if (should === running) return;
      running = should;
      if (should) {
        last = 0;
        raf = requestAnimationFrame(frame);
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const io = new IntersectionObserver(
      (es) => {
        onScreen = es.some((e) => e.isIntersecting);
        sync();
      },
      { rootMargin: "100px" },
    );
    io.observe(host);

    const onVis = () => {
      hidden = document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVis);

    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointermove", onDrag);
    host.addEventListener("pointerup", onRelease);
    host.addEventListener("pointercancel", onRelease);

    const ro = new ResizeObserver(() => resize());
    ro.observe(host);

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onDrag);
      host.removeEventListener("pointerup", onRelease);
      host.removeEventListener("pointercancel", onRelease);
      for (const t of textures) t.dispose();
      atlas.dispose();
      bodyGeo.dispose();
      stickerGeo.dispose();
      stickerOutline.dispose();
      glyphPlane.dispose();
      edgeGeo.dispose();
      lineMat.dispose();
      lineAtlas.dispose();
      bodyMat.dispose();
      for (const m of glyphMats) m.dispose();
      pmrem.dispose();
      env.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [start, mode, letters, variant]);

  const dots = {
    backgroundImage: `radial-gradient(${MARK} 1px, transparent 1px)`,
    backgroundSize: "7px 7px",
  };

  return (
    <div
      className={cn("relative h-full w-full overflow-hidden", className)}
      style={{ background: FIELD }}
    >
      <div
        ref={hostRef}
        aria-hidden="true"
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
      />

      {/* Furniture (§6.4). Marks only — no words on the plate. Flat, DOM,
          and perfectly still: its stillness is what makes the object behind
          it feel like it is moving. Nothing here reacts to the cube. */}
      <div className="pointer-events-none absolute inset-0 select-none" style={{ color: MARK }}>
        {[
          "left-4 top-4 border-l border-t",
          "right-4 top-4 border-r border-t",
          "left-4 bottom-4 border-l border-b",
          "right-4 bottom-4 border-r border-b",
        ].map((cls) => (
          <div key={cls} className={`absolute h-4 w-4 border-current opacity-40 ${cls}`} />
        ))}

        <div className="absolute bottom-5 right-8 h-8 w-24 opacity-25" style={dots} />
        <div className="absolute left-6 top-1/2 h-16 w-6 opacity-20" style={dots} />

        <div className="absolute left-1/2 top-4 h-3 w-px bg-current opacity-25" />
        <div className="absolute bottom-4 left-1/2 h-3 w-px bg-current opacity-25" />
      </div>

      {failure && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <p
            role="alert"
            className="max-w-md rounded-lg border border-red-500/40 bg-red-950/60 px-4 py-3 text-center font-mono text-[12px] leading-relaxed text-red-100"
          >
            {failure}
          </p>
        </div>
      )}

      {/* The letters stay reachable as text without sitting on the plate —
          nobody should have to watch a cube solve itself for the information. */}
      <p className="sr-only">Letters formed by this piece: {GLYPH_ORDER.join(", ")}</p>
    </div>
  );
}
