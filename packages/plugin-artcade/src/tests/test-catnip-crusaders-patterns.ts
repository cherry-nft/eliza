import { PatternData } from "./test-insert-example";

export const catnipCrusadersPatterns = [
    {
        type: "layout",
        pattern_name: "centered-game-canvas-dark-theme",
        content: {
            html: `<canvas id="game"></canvas>`,
            css: `body{margin:0;background:#222;display:flex;justify-content:center;align-items:center;height:100vh;overflow:hidden}canvas{background:#000;image-rendering:pixelated;box-shadow:0 0 20px rgba(0,0,0,0.5)}`,
            js: `const canvas=document.getElementById('game'),ctx=canvas.getContext('2d'),w=800,h=600;canvas.width=w;canvas.height=h;`,
            context:
                "A centered, full-viewport canvas layout with dark theme and pixelated rendering",
            metadata: {
                type: "game_layout",
                theme: "dark",
                colors: {
                    background: "#222",
                    canvas: "#000",
                },
                components: ["game_canvas"],
                features: ["pixelated", "centered", "fullscreen"],
            },
        },
        room_id: "dark_theme-centered_layout-game_canvas-pixelated_render",
    },
    {
        type: "game_mechanic",
        pattern_name: "game-state-initialization",
        content: {
            js: `let player={x:w/2,y:h-50,w:50,h:25,speed:5,lives:3,score:0},lasers=[],cucumbers=[],powerups=[],gameOver=false,gameStarted=false,powerupChance=.01;`,
            html: `<canvas id="game"></canvas>`,
            context:
                "Game state initialization with player, projectiles, enemies, and powerups",
            metadata: {
                type: "game_mechanic",
                features: ["state_management", "game_objects", "player_stats"],
                state_types: ["player", "projectiles", "enemies", "powerups"],
            },
        },
        room_id: "game_state-initialization-objects-stats",
    },
    {
        type: "interaction",
        pattern_name: "keyboard-shooter-movement",
        content: {
            js: `function clamp(v,min,max){return Math.min(Math.max(v,min),max)}

function updatePlayer(){player.x=clamp(player.x+((keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0))*player.speed,0,w-player.w)}

let keys={};
window.addEventListener('keydown',e=>{keys[e.code]=true});
window.addEventListener('keyup',e=>{keys[e.code]=false});`,
            html: `<canvas id="game"></canvas>`,
            context:
                "Smooth keyboard-controlled player movement with boundary checking",
            metadata: {
                type: "game_mechanic",
                features: [
                    "keyboard_input",
                    "smooth_movement",
                    "boundary_checking",
                ],
                input_type: "keyboard",
                movement_type: "horizontal",
            },
        },
        room_id:
            "keyboard_input-smooth_movement-boundary_checking-horizontal_movement",
    },
    {
        type: "game_mechanic",
        pattern_name: "projectile-system",
        content: {
            js: `function updateLasers(){lasers=lasers.filter(l=>{l.y-=10;return l.y>-50});lasers.forEach(l=>{cucumbers.forEach(c=>{if(l.x>c.x&&l.x<c.x+c.w&&l.y>c.y&&l.y<c.y+c.h){c.lives--;player.score+=10;if(!c.lives){const i=cucumbers.indexOf(c);cucumbers.splice(i,1);if(Math.random()<powerupChance)spawnPowerup()}}});powerups.forEach(p=>{if(l.x>p.x&&l.x<p.x+p.w&&l.y>p.y&&l.y<p.y+p.h){p.lives=0;if(p.type==='catnip'){player.lives=Math.min(player.lives+1,5);player.score+=50}else{lasers=lasers.concat(Array(5).fill(0).map((_,i)=>({x:player.x+i*10,y:player.y-25,w:5,h:15})))}}})});if(lasers.length<10)lasers.push({x:player.x+player.w/2-2,y:player.y-25,w:5,h:15})}`,
            html: `<canvas id="game"></canvas>`,
            context:
                "Projectile system with collision detection, scoring, and powerup interaction",
            metadata: {
                type: "game_mechanic",
                features: [
                    "projectile_management",
                    "collision_detection",
                    "scoring_system",
                    "powerup_interaction",
                ],
                collision_type: "rectangle",
                projectile_type: "laser",
            },
        },
        room_id:
            "projectile_system-collision_detection-scoring-powerup_interaction",
    },
    {
        type: "game_mechanic",
        pattern_name: "enemy-spawning-system",
        content: {
            js: `function spawnCucumber(){const x=Math.random()*(w-100)+50,y=-50,speed=2+Math.random()*3;cucumbers.push({x,y,w:50,h:50,speed})}

function updateCucumbers(){cucumbers.forEach(c=>{c.y+=c.speed;if(c.y>h+50){const i=cucumbers.indexOf(c);cucumbers.splice(i,1);player.lives--}});if(!cucumbers.length||Math.random()<.01)spawnCucumber()}`,
            html: `<canvas id="game"></canvas>`,
            context:
                "Dynamic enemy spawning system with varied movement patterns",
            metadata: {
                type: "game_mechanic",
                features: [
                    "enemy_spawning",
                    "random_positioning",
                    "varied_speed",
                    "life_system",
                ],
                spawn_type: "top_edge",
                movement_type: "vertical",
            },
        },
        room_id: "enemy_spawn-random_position-varied_speed-life_system",
    },
    {
        type: "game_mechanic",
        pattern_name: "powerup-system",
        content: {
            js: `function spawnPowerup(){const x=Math.random()*(w-50),y=-50,type=Math.random()<.5?'catnip':'yarn';powerups.push({x,y,w:25,h:25,type,speed:2})}

function updatePowerups(){powerups=powerups.filter(p=>{p.y+=p.speed;return p.y<h+50&&p.lives});if(!powerups.length||Math.random()<powerupChance)spawnPowerup()}`,
            html: `<canvas id="game"></canvas>`,
            context: "Multi-type powerup system with different effects",
            metadata: {
                type: "game_mechanic",
                features: [
                    "powerup_spawning",
                    "multiple_types",
                    "varied_effects",
                    "collection_system",
                ],
                powerup_types: ["health", "weapon"],
                spawn_type: "random",
            },
        },
        room_id: "powerup_system-multiple_types-varied_effects-collection",
    },
    {
        type: "game_mechanic",
        pattern_name: "collision-and-game-over",
        content: {
            js: `function handleCollisions(){cucumbers.forEach(c=>{if(player.x<c.x+c.w&&player.x+player.w>c.x&&player.y<c.y+c.h&&player.y+player.h>c.y){gameOver=true}})}

window.addEventListener('click',()=>{if(gameOver)location.reload()})`,
            html: `<canvas id="game"></canvas>`,
            context: "Player-enemy collision detection and game over handling",
            metadata: {
                type: "game_mechanic",
                features: ["collision_detection", "game_over", "restart"],
                collision_type: "rectangle",
                restart_type: "click",
            },
        },
        room_id: "collision_detection-game_over-restart",
    },
    {
        type: "game_mechanic",
        pattern_name: "game-loop-and-rendering",
        content: {
            js: `function drawPlayer(){ctx.fillStyle='#fa0';ctx.fillRect(player.x,player.y,player.w,player.h)}

function drawLasers(){ctx.fillStyle='#f90';lasers.forEach(l=>ctx.fillRect(l.x,l.y,l.w,l.h))}

function drawCucumbers(){ctx.fillStyle='#0f6';cucumbers.forEach(c=>ctx.fillRect(c.x,c.y,c.w,c.h))}

function drawPowerups(){ctx.fillStyle='#ff0';powerups.forEach(p=>ctx.fillRect(p.x,p.y,p.w,p.h))}

function drawUI(){ctx.fillStyle='#fff';ctx.font='24px monospace';ctx.fillText(\`Score: \${player.score}\`,10,30);ctx.fillText(\`Lives: \${player.lives}\`,10,60)}

function render(){ctx.clearRect(0,0,w,h);if(!gameOver){drawPlayer();drawLasers();drawCucumbers();drawPowerups();drawUI()}else{ctx.fillStyle='#fff';ctx.font='64px monospace';ctx.fillText('Game Over',w/2-180,h/2)}}

let lastTime=performance.now();

function update(time){if(!gameStarted){gameStarted=true;requestAnimationFrame(update)}const dt=time-lastTime;lastTime=time;if(!gameOver){updatePlayer();updateLasers();updateCucumbers();updatePowerups();handleCollisions()}render();requestAnimationFrame(update)}

update();`,
            html: `<canvas id="game"></canvas>`,
            context: "Game loop with rendering and state updates",
            metadata: {
                type: "game_mechanic",
                features: [
                    "game_loop",
                    "rendering",
                    "state_updates",
                    "animation_frame",
                ],
                render_components: [
                    "player",
                    "projectiles",
                    "enemies",
                    "powerups",
                    "ui",
                ],
                update_components: ["movement", "collisions", "spawning"],
            },
        },
        room_id: "game_loop-rendering-state_updates",
    },
];

export type { PatternData };
