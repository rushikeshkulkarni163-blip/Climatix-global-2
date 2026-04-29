"use client";
import { useEffect, useRef } from "react";

export default function GlobeComponent() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    let frameId: number;
    let cleanupFn: (() => void) | undefined;

    const init = async () => {
      try {
        const THREE = await import("three");
        const mount = mountRef.current;
        if (!mount || !mounted) return;

        const w = mount.clientWidth || 500;
        const h = mount.clientHeight || 500;

        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 1000);
        camera.position.z = 2.7;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x000000, 0);
        mount.appendChild(renderer.domElement);

        // Globe base sphere
        const globe = new THREE.Mesh(
          new THREE.SphereGeometry(1, 64, 64),
          new THREE.MeshPhongMaterial({
            color: 0x071428,
            emissive: 0x020a18,
            specular: 0x1a3a6a,
            shininess: 22,
          })
        );
        scene.add(globe);

        // Lat/lon grid overlay
        const grid = new THREE.Mesh(
          new THREE.SphereGeometry(1.004, 20, 20),
          new THREE.MeshBasicMaterial({
            color: 0x0d2a5a,
            wireframe: true,
            transparent: true,
            opacity: 0.3,
          })
        );
        scene.add(grid);

        // Outer atmosphere glow
        scene.add(
          new THREE.Mesh(
            new THREE.SphereGeometry(1.15, 32, 32),
            new THREE.MeshBasicMaterial({
              color: 0x0a2a6a,
              transparent: true,
              opacity: 0.065,
              side: THREE.BackSide,
            })
          )
        );

        // Helper: lat/lon → position on sphere surface
        const latLon = (lat: number, lon: number, r = 1.025) => {
          const phi = (90 - lat) * (Math.PI / 180);
          const theta = (lon + 180) * (Math.PI / 180);
          return new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.cos(phi),
            Math.sin(phi) * Math.sin(theta)
          ).multiplyScalar(r);
        };

        // Risk zone markers (lat, lon, color, size)
        const MARKERS: [number, number, number, number][] = [
          [50,   10,   0xff3333, 0.020], // Central Europe
          [22,  114,   0xff6600, 0.024], // South China
          [25,   55,   0xff3333, 0.022], // Middle East
          [-23,  -47,  0xff6600, 0.018], // Brazil
          [28,   77,   0xff3333, 0.021], // India
          [40,  -74,   0xffaa00, 0.017], // USA East Coast
          [-34,  151,  0xff6600, 0.016], // Australia
          [51,    0,   0xffaa00, 0.015], // UK
          [35,  140,   0xff6600, 0.015], // Japan
          [30,   31,   0xff3333, 0.018], // Egypt / North Africa
          [60,   30,   0xffaa00, 0.014], // Russia
          [-29,   25,  0xff6600, 0.015], // South Africa
          [19,  -99,   0xff6600, 0.017], // Mexico
          [-34,  -58,  0xffaa00, 0.015], // Argentina
        ];

        MARKERS.forEach(([lat, lon, color, size]) => {
          const dot = new THREE.Mesh(
            new THREE.SphereGeometry(size, 7, 7),
            new THREE.MeshBasicMaterial({ color })
          );
          dot.position.copy(latLon(lat, lon));
          scene.add(dot);
        });

        // Lighting
        scene.add(new THREE.AmbientLight(0x112244, 3.2));
        const key = new THREE.DirectionalLight(0x3366cc, 2.8);
        key.position.set(4, 2, 3);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0x001133, 1.2);
        fill.position.set(-3, -1, -2);
        scene.add(fill);

        // Render loop
        const tick = () => {
          if (!mounted) return;
          frameId = requestAnimationFrame(tick);
          globe.rotation.y += 0.0016;
          grid.rotation.y += 0.0016;
          renderer.render(scene, camera);
        };
        tick();

        // Handle container resize
        const onResize = () => {
          const nw = mount.clientWidth;
          const nh = mount.clientHeight;
          if (!nw || !nh) return;
          camera.aspect = nw / nh;
          camera.updateProjectionMatrix();
          renderer.setSize(nw, nh);
        };
        window.addEventListener("resize", onResize);

        cleanupFn = () => {
          cancelAnimationFrame(frameId);
          window.removeEventListener("resize", onResize);
          if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
          renderer.dispose();
        };
      } catch (err) {
        console.error("[GlobeComponent] init failed:", err);
      }
    };

    init();

    return () => {
      mounted = false;
      cleanupFn?.();
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full" />;
}
