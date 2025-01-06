import { PatternData } from "./test-insert-example";

export const airHockeyPatterns = [
    {
        type: "layout",
        pattern_name: "centered-game-canvas-scoreboard",
        content: {
            html: `<div id="scoreBoard">Player: 0 | AI: 0</div>
<canvas id="gameCanvas" width="400" height="600"></canvas>`,
            css: `body{display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#1a1a1a;font-family:Arial,sans-serif;overflow:hidden;touch-action:none}
#gameCanvas{border:10px solid #444;border-radius:20px;box-shadow:0 0 20px rgba(0,0,0,.5)}
#scoreBoard{position:absolute;top:20px;font-size:32px;font-weight:700;color:#fff;text-shadow:2px 2px 4px rgba(0,0,0,.5)}`,
            context:
                "A centered, full-viewport layout for canvas-based games with a floating scoreboard",
            metadata: {
                type: "game_layout",
                theme: "dark",
                colors: {
                    background: "#1a1a1a",
                    border: "#444",
                    text: "#ffffff",
                },
                components: ["game_canvas", "score_display"],
                canvas_size: {
                    width: 400,
                    height: 600,
                },
            },
        },
        room_id:
            "dark_theme-centered_layout-game_canvas-floating_score-responsive_design",
    },
    {
        type: "game_mechanic",
        pattern_name: "air-hockey-physics-ai",
        content: {
            js: `function collisionDetection(){
if(puck.x+puck.dx>canvas.width-puck.radius||puck.x+puck.dx<puck.radius)puck.dx=-puck.dx;
if((puck.y+puck.dy>canvas.height-puck.radius&&(puck.x<=(canvas.width-goal.width)/2||puck.x>=(canvas.width+goal.width)/2))||(puck.y+puck.dy<puck.radius&&(puck.x<=(canvas.width-goal.width)/2||puck.x>=(canvas.width+goal.width)/2)))puck.dy=-puck.dy;
const dp=Math.hypot(puck.x-paddle.x,puck.y-paddle.y),da=Math.hypot(puck.x-aiPaddle.x,puck.y-aiPaddle.y);
if(dp<puck.radius+paddle.radius){const a=Math.atan2(puck.y-paddle.y,puck.x-paddle.x);puck.dx=Math.cos(a)*puck.speed;puck.dy=Math.sin(a)*puck.speed}
if(da<puck.radius+aiPaddle.radius){const a=Math.atan2(puck.y-aiPaddle.y,puck.x-aiPaddle.x);puck.dx=Math.cos(a)*puck.speed;puck.dy=Math.sin(a)*puck.speed}
if(puck.y>canvas.height-puck.radius&&puck.x>(canvas.width-goal.width)/2&&puck.x<(canvas.width+goal.width)/2){
aiScore++;resetPuck();lastScoreTime=Date.now();goalEffect={active:true,startTime:Date.now(),scorer:'AI'};createExplosion(puck.x,canvas.height)
}else if(puck.y<puck.radius&&puck.x>(canvas.width-goal.width)/2&&puck.x<(canvas.width+goal.width)/2){
playerScore++;resetPuck();lastScoreTime=Date.now();goalEffect={active:true,startTime:Date.now(),scorer:'Player'};createExplosion(puck.x,0)
}
puck.x=Math.min(Math.max(puck.x,puck.radius),canvas.width-puck.radius);
puck.y=Math.min(Math.max(puck.y,puck.radius),canvas.height-puck.radius)}

function moveAIPaddle(){
const c=aiPaddle.x;
const d=Math.abs(c-canvas.width/2);
if(aiState==='normal'&&isPuckStuck()){
aiState='retreating';
puckStuckTime=0;
}
if(aiState==='retreating'){
const targetX=canvas.width/2;
const targetY=aiPaddle.radius;
const dx=targetX-aiPaddle.x;
const dy=targetY-aiPaddle.y;
const distance=Math.sqrt(dx*dx+dy*dy);
if(distance>aiPaddle.speed){
aiPaddle.x+=dx/distance*aiPaddle.speed*simulationSpeedMultiplier;
aiPaddle.y+=dy/distance*aiPaddle.speed*simulationSpeedMultiplier;
}else{
aiPaddle.x=targetX;
aiPaddle.y=targetY;
aiState='waiting';
aiWaitTime=0;
}
}else if(aiState==='waiting'){
aiWaitTime+=simulationSpeedMultiplier;
if(aiWaitTime>60){  // Wait for 1 second (60 frames)
aiState='playing';
}
}else if(aiState==='playing'){
if(Math.abs(puck.x-c)>5)puck.x>c?aiPaddle.x+=aiPaddle.speed*simulationSpeedMultiplier:aiPaddle.x-=aiPaddle.speed*simulationSpeedMultiplier;
aiPaddle.y=Math.min(aiPaddle.y+aiPaddle.speed*simulationSpeedMultiplier,canvas.height/2-aiPaddle.radius);
if(aiPaddle.y===canvas.height/2-aiPaddle.radius){
aiState='normal';
}
}else if(aiState==='normal'){
if(puck.y<canvas.height/2){
if(Math.abs(puck.x-c)>5)puck.x>c?aiPaddle.x+=aiPaddle.speed*simulationSpeedMultiplier:aiPaddle.x-=aiPaddle.speed*simulationSpeedMultiplier;
puck.y>aiPaddle.y&&Math.abs(puck.x-c)<50?aiPaddle.y+=aiPaddle.speed*simulationSpeedMultiplier:aiPaddle.y+=(50-aiPaddle.y)*.05*simulationSpeedMultiplier
}else{
d>70?aiPaddle.x+=(canvas.width/2-c)*.03*simulationSpeedMultiplier:Math.abs(puck.x-c)>10&&(puck.x>c?aiPaddle.x+=aiPaddle.speed*simulationSpeedMultiplier:aiPaddle.x-=aiPaddle.speed*simulationSpeedMultiplier);
aiPaddle.y+=(50-aiPaddle.y)*.05*simulationSpeedMultiplier
}
}
aiPaddle.x=Math.min(Math.max(aiPaddle.x,aiPaddle.radius),canvas.width-aiPaddle.radius);
aiPaddle.y=Math.min(Math.max(aiPaddle.y,aiPaddle.radius),canvas.height/2-aiPaddle.radius)}`,
            context:
                "Physics system for air hockey with circular collision detection and AI opponent",
            metadata: {
                type: "game_physics",
                features: [
                    "collision_detection",
                    "ai_opponent",
                    "physics_simulation",
                    "state_machine",
                ],
                collision_types: [
                    "wall_collision",
                    "paddle_collision",
                    "goal_detection",
                ],
                ai_behaviors: ["normal", "retreating", "waiting", "playing"],
            },
        },
        room_id:
            "game_physics-collision_detection-ai_opponent-state_machine-paddle_movement",
    },
    {
        type: "animation",
        pattern_name: "goal-explosion-particles",
        content: {
            js: `function createExplosion(x,y){
for(let i=0;i<50;i++)particles.push({x,y,radius:Math.random()*3+1,color:\`hsl(\${Math.random()*60+15},100%,50%)\`,velocity:{x:(Math.random()-.5)*8*simulationSpeedMultiplier,y:(Math.random()-.5)*8*simulationSpeedMultiplier},alpha:1})
}

function drawExplosion(){
particles.forEach((p,i)=>{
if(p.alpha<=0)particles.splice(i,1);
else{
p.velocity.y+=.05*simulationSpeedMultiplier;p.x+=p.velocity.x;p.y+=p.velocity.y;p.alpha-=.02*simulationSpeedMultiplier;
ctx.save();ctx.globalAlpha=p.alpha;ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);ctx.fillStyle=p.color;ctx.fill();ctx.restore()
}})
}`,
            context:
                "Particle explosion animation system with physics and color variation",
            metadata: {
                type: "visual_effect",
                effect_type: "particle_system",
                features: [
                    "physics_based",
                    "color_variation",
                    "alpha_fade",
                    "gravity",
                ],
                particle_count: 50,
                color_scheme: "warm",
                physics_properties: ["velocity", "gravity", "alpha_decay"],
            },
        },
        room_id:
            "particle_system-explosion_effect-physics_animation-color_variation-visual_feedback",
    },
    {
        type: "interaction",
        pattern_name: "smooth-paddle-control",
        content: {
            js: `function movePaddle(x,y){
let r=canvas.getBoundingClientRect();
paddle.x=Math.min(Math.max(x-r.left,paddle.radius),canvas.width-paddle.radius);
paddle.y=Math.min(Math.max(y-r.top,canvas.height/2+paddle.radius),canvas.height-paddle.radius)
}

function handleMouseMove(e){
movePaddle(e.clientX,e.clientY);
}

function handleTouchMove(e){
e.preventDefault();
const touch=e.touches[0];
movePaddle(touch.clientX,touch.clientY);
}

document.addEventListener('mousemove',handleMouseMove,false);
document.addEventListener('touchmove',handleTouchMove,{passive:false});
document.addEventListener('touchstart',handleTouchMove,{passive:false});`,
            context:
                "Unified mouse and touch input handling for smooth paddle control",
            metadata: {
                type: "input_handler",
                input_types: ["mouse", "touch"],
                features: [
                    "boundary_checking",
                    "smooth_movement",
                    "cross_platform",
                ],
                constraints: ["paddle_radius", "canvas_bounds", "play_area"],
            },
        },
        room_id:
            "input_handling-cross_platform-smooth_movement-boundary_constraints-paddle_control",
    },
];

export type { PatternData };
