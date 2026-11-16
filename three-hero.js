/* Simple 3D hero scene for EVA Mobile (Three.js, progressive enhancement). */
(function () {
    "use strict";

    function init() {
        if (!window.THREE) return;
        var canvas = document.getElementById("hero3dCanvas");
        var stage = document.getElementById("hero3dStage");
        if (!canvas || !stage) return;

        var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        var renderer;
        try {
            renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
        } catch (_) {
            return;
        }

        var scene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
        camera.position.set(0, 0.2, 6.2);

        var ambient = new THREE.AmbientLight(0xffffff, 0.9);
        scene.add(ambient);
        var key = new THREE.DirectionalLight(0xffd3b0, 1.15);
        key.position.set(3, 4, 5);
        scene.add(key);
        var fill = new THREE.PointLight(0x5fa8ff, 0.9, 30);
        fill.position.set(-4, -1, 3);
        scene.add(fill);
        var rim = new THREE.PointLight(0xff6a00, 0.8, 20);
        rim.position.set(2, -2, 2);
        scene.add(rim);

        var phoneGroup = new THREE.Group();
        scene.add(phoneGroup);

        // Phone body
        var bodyGeom = new THREE.BoxGeometry(1.85, 3.7, 0.18);
        var bodyMat = new THREE.MeshStandardMaterial({
            color: 0x101827,
            metalness: 0.75,
            roughness: 0.25
        });
        var body = new THREE.Mesh(bodyGeom, bodyMat);
        phoneGroup.add(body);

        // Screen
        var screenGeom = new THREE.PlaneGeometry(1.62, 3.3);
        var screenMat = new THREE.MeshStandardMaterial({
            color: 0x1b2a52,
            emissive: 0x0e1b3d,
            emissiveIntensity: 0.85,
            metalness: 0.15,
            roughness: 0.35
        });
        var screen = new THREE.Mesh(screenGeom, screenMat);
        screen.position.z = 0.095;
        phoneGroup.add(screen);

        // Screen glow/accent
        var glowGeom = new THREE.PlaneGeometry(1.2, 1.2);
        var glowMat = new THREE.MeshBasicMaterial({ color: 0xff6a00, transparent: true, opacity: 0.18 });
        var glow = new THREE.Mesh(glowGeom, glowMat);
        glow.position.set(0.1, -0.8, 0.097);
        phoneGroup.add(glow);
        var glow2 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ color: 0x4f8cff, transparent: true, opacity: 0.16 }));
        glow2.position.set(-0.25, 0.9, 0.097);
        phoneGroup.add(glow2);

        // Camera bump
        var bump = new THREE.Mesh(
            new THREE.BoxGeometry(0.38, 0.38, 0.04),
            new THREE.MeshStandardMaterial({ color: 0x0b1220, metalness: 0.8, roughness: 0.2 })
        );
        bump.position.set(0, 1.25, -0.11);
        phoneGroup.add(bump);

        // Floating rings for 3D depth
        var ringMat = new THREE.MeshStandardMaterial({ color: 0xff8a2a, metalness: 0.55, roughness: 0.35, transparent: true, opacity: 0.85 });
        var ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.045, 16, 100), ringMat);
        ring1.rotation.x = Math.PI * 0.52;
        ring1.rotation.y = Math.PI * 0.18;
        ring1.position.set(0, 0, -0.2);
        scene.add(ring1);

        var ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.03, 16, 120), new THREE.MeshStandardMaterial({ color: 0x7cc0ff, metalness: 0.4, roughness: 0.4, transparent: true, opacity: 0.55 }));
        ring2.rotation.x = Math.PI * 0.42;
        ring2.rotation.y = -Math.PI * 0.22;
        ring2.position.set(0, 0, -0.5);
        scene.add(ring2);

        // Small floating particles
        var particles = new THREE.Group();
        var dotGeom = new THREE.SphereGeometry(0.045, 10, 10);
        var dotColors = [0xff6a00, 0xffffff, 0x79b8ff];
        for (var i = 0; i < 18; i++) {
            var dot = new THREE.Mesh(dotGeom, new THREE.MeshBasicMaterial({ color: dotColors[i % dotColors.length], transparent: true, opacity: 0.85 }));
            var a = (i / 18) * Math.PI * 2;
            var r = 2.1 + (i % 3) * 0.35;
            dot.position.set(Math.cos(a) * r, Math.sin(a * 1.2) * 1.4, -0.2 + (i % 4) * 0.15);
            dot.userData.base = dot.position.clone();
            dot.userData.phase = i * 0.7;
            particles.add(dot);
        }
        scene.add(particles);

        phoneGroup.rotation.x = -0.08;
        phoneGroup.rotation.y = -0.55;

        var targetRX = -0.08, targetRY = -0.55;
        var pointerX = 0, pointerY = 0;

        function resize() {
            var rect = stage.getBoundingClientRect();
            var w = Math.max(220, Math.floor(rect.width || 340));
            var h = Math.max(260, Math.floor(rect.height || 420));
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            renderer.setPixelRatio(dpr);
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        }

        function onPointer(e) {
            var rect = stage.getBoundingClientRect();
            var x = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
            var y = ((e.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1;
            pointerX = Math.max(-1, Math.min(1, x));
            pointerY = Math.max(-1, Math.min(1, y));
            targetRY = -0.55 + pointerX * 0.7;
            targetRX = -0.08 + pointerY * 0.35;
        }

        function onLeave() {
            targetRY = -0.55;
            targetRX = -0.08;
        }

        stage.addEventListener("pointermove", onPointer);
        stage.addEventListener("pointerleave", onLeave);

        var start = performance.now();
        function animate(now) {
            requestAnimationFrame(animate);
            var t = (now - start) * 0.001;

            if (!reduceMotion) {
                ring1.rotation.z += 0.003;
                ring2.rotation.z -= 0.0022;
                particles.children.forEach(function (d) {
                    d.position.y = d.userData.base.y + Math.sin(t * 1.2 + d.userData.phase) * 0.12;
                    d.position.x = d.userData.base.x + Math.cos(t * 0.9 + d.userData.phase) * 0.06;
                });
                phoneGroup.position.y = Math.sin(t * 1.4) * 0.08;
            }

            phoneGroup.rotation.y += (targetRY - phoneGroup.rotation.y) * 0.08;
            phoneGroup.rotation.x += (targetRX - phoneGroup.rotation.x) * 0.08;

            renderer.render(scene, camera);
        }

        resize();
        window.addEventListener("resize", resize);
        requestAnimationFrame(animate);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        window.setTimeout(init, 0);
    }
})();