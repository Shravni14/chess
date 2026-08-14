export type Color = "w" | "b";
export type PieceType = "P" | "N" | "B" | "R" | "Q" | "K";
export type Piece = `${Color}${PieceType}`;
export type Board = (Piece | null)[][];
export type Square = [number, number];
export type Move = { from: Square; to: Square; capture?: boolean; promotion?: boolean; castle?: "K" | "Q"; enPassant?: boolean; doubleStep?: boolean };
export type CastlingRights = { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
export type GameState = { castling: CastlingRights; enPassant: Square | null; turn: Color; halfmove: number; fullmove: number };
export type GameStatus = "playing" | "check" | "checkmate" | "stalemate" | "draw-50move" | "draw-repetition" | "draw-insufficient";
export type SerializedGame = { board: Board; state: GameState; history: string[]; captured: { w: Piece[]; b: Piece[] }; repetition: Record<string, number>; lastMove: { from: Square; to: Square } | null };

export const FILES = ["a","b","c","d","e","f","g","h"];
export const GLYPHS: Record<Piece,string> = {wK:"♔",wQ:"♕",wR:"♖",wB:"♗",wN:"♘",wP:"♙",bK:"♚",bQ:"♛",bR:"♜",bB:"♝",bN:"♞",bP:"♟"};
export const PIECE_VALUE: Record<PieceType,number> = {P:100,N:320,B:330,R:500,Q:900,K:0};

export const inBounds=(r:number,c:number)=>r>=0&&r<8&&c>=0&&c<8;
export const colorOf=(p:Piece|null|undefined):Color|null=>p?p[0] as Color:null;
export const typeOf=(p:Piece|null|undefined):PieceType|null=>p?p[1] as PieceType:null;
export const opposite=(c:Color):Color=>c==="w"?"b":"w";
export const cloneBoard=(b:Board):Board=>b.map(row=>[...row]);
export const squareName=(r:number,c:number)=>`${FILES[c]}${8-r}`;
export const sameSquare=(a:Square|null,b:Square|null)=>!!a&&!!b&&a[0]===b[0]&&a[1]===b[1];

export function initialBoard():Board{const back:PieceType[]=["R","N","B","Q","K","B","N","R"];const b:Board=Array.from({length:8},()=>Array<Piece|null>(8).fill(null));for(let c=0;c<8;c++){b[0][c]=`b${back[c]}` as Piece;b[1][c]="bP";b[6][c]="wP";b[7][c]=`w${back[c]}` as Piece;}return b;}
export function initialState():GameState{return{castling:{wK:true,wQ:true,bK:true,bQ:true},enPassant:null,turn:"w",halfmove:0,fullmove:1};}
export function findKing(b:Board,c:Color):Square|null{for(let r=0;r<8;r++)for(let col=0;col<8;col++)if(b[r][col]===`${c}K`)return[r,col];return null;}
export function isSquareAttacked(b:Board,r:number,c:number,by:Color){const pr=r+(by==="w"?1:-1);for(const dc of[-1,1])if(inBounds(pr,c+dc)&&b[pr][c+dc]===`${by}P`)return true;for(const[dr,dc]of[[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]])if(inBounds(r+dr,c+dc)&&b[r+dr][c+dc]===`${by}N`)return true;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if((dr||dc)&&inBounds(r+dr,c+dc)&&b[r+dr][c+dc]===`${by}K`)return true;for(const[dr,dc]of[[1,1],[1,-1],[-1,1],[-1,-1]]){let nr=r+dr,nc=c+dc;while(inBounds(nr,nc)){const p=b[nr][nc];if(p){if(colorOf(p)===by&&(typeOf(p)==="B"||typeOf(p)==="Q"))return true;break;}nr+=dr;nc+=dc;}}for(const[dr,dc]of[[1,0],[-1,0],[0,1],[0,-1]]){let nr=r+dr,nc=c+dc;while(inBounds(nr,nc)){const p=b[nr][nc];if(p){if(colorOf(p)===by&&(typeOf(p)==="R"||typeOf(p)==="Q"))return true;break;}nr+=dr;nc+=dc;}}return false;}
export const isInCheck=(b:Board,c:Color)=>{const k=findKing(b,c);return!!k&&isSquareAttacked(b,k[0],k[1],opposite(c));};

export function pseudoMovesForSquare(b:Board,r:number,c:number,s:GameState):Move[]{const p=b[r][c];if(!p)return[];const color=colorOf(p)!;const type=typeOf(p)!;const out:Move[]=[];const slide=(dirs:number[][])=>{for(const[dr,dc]of dirs){let nr=r+dr,nc=c+dc;while(inBounds(nr,nc)){const target=b[nr][nc];if(!target)out.push({from:[r,c],to:[nr,nc]});else{if(colorOf(target)!==color&&typeOf(target)!=="K")out.push({from:[r,c],to:[nr,nc],capture:true});break;}nr+=dr;nc+=dc;}}};
if(type==="P"){const dir=color==="w"?-1:1,start=color==="w"?6:1,promo=color==="w"?0:7;if(inBounds(r+dir,c)&&!b[r+dir][c]){out.push({from:[r,c],to:[r+dir,c],promotion:r+dir===promo});if(r===start&&!b[r+2*dir][c])out.push({from:[r,c],to:[r+2*dir,c],doubleStep:true});}for(const dc of[-1,1]){const nr=r+dir,nc=c+dc;if(!inBounds(nr,nc))continue;const target=b[nr][nc];if(target&&colorOf(target)!==color&&typeOf(target)!=="K")out.push({from:[r,c],to:[nr,nc],capture:true,promotion:nr===promo});else if(!target&&s.enPassant?.[0]===nr&&s.enPassant?.[1]===nc)out.push({from:[r,c],to:[nr,nc],capture:true,enPassant:true});}}
else if(type==="N"){for(const[dr,dc]of[[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]]){const nr=r+dr,nc=c+dc;if(!inBounds(nr,nc))continue;const target=b[nr][nc];if(!target||(colorOf(target)!==color&&typeOf(target)!=="K"))out.push({from:[r,c],to:[nr,nc],capture:!!target});}}
else if(type==="B")slide([[1,1],[1,-1],[-1,1],[-1,-1]]);else if(type==="R")slide([[1,0],[-1,0],[0,1],[0,-1]]);else if(type==="Q")slide([[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]]);else{for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if((dr||dc)&&inBounds(r+dr,c+dc)){const target=b[r+dr][c+dc];if(!target||(colorOf(target)!==color&&typeOf(target)!=="K"))out.push({from:[r,c],to:[r+dr,c+dc],capture:!!target});}const home=color==="w"?7:0;if(r===home&&c===4&&!isInCheck(b,color)){if(s.castling[`${color}K`]&&!b[home][5]&&!b[home][6]&&b[home][7]===`${color}R`&&!isSquareAttacked(b,home,5,opposite(color))&&!isSquareAttacked(b,home,6,opposite(color)))out.push({from:[r,c],to:[home,6],castle:"K"});if(s.castling[`${color}Q`]&&!b[home][1]&&!b[home][2]&&!b[home][3]&&b[home][0]===`${color}R`&&!isSquareAttacked(b,home,3,opposite(color))&&!isSquareAttacked(b,home,2,opposite(color)))out.push({from:[r,c],to:[home,2],castle:"Q"});}}return out;}

export function applyMove(b:Board,s:GameState,m:Move,promotion:PieceType="Q"){const nb=cloneBoard(b);const[fr,fc]=m.from,[tr,tc]=m.to;const piece=nb[fr][fc];if(!piece)throw new Error("Empty square");const color=colorOf(piece)!;const type=typeOf(piece)!;let captured=nb[tr][tc];nb[fr][fc]=null;if(m.enPassant){const row=color==="w"?tr+1:tr-1;captured=nb[row][tc];nb[row][tc]=null;}nb[tr][tc]=m.promotion?`${color}${promotion}` as Piece:piece;if(m.castle==="K"){const row=color==="w"?7:0;nb[row][5]=`${color}R`;nb[row][7]=null;}if(m.castle==="Q"){const row=color==="w"?7:0;nb[row][3]=`${color}R`;nb[row][0]=null;}const rights={...s.castling};if(type==="K"){rights[`${color}K`]=false;rights[`${color}Q`]=false;}if(type==="R"){const row=color==="w"?7:0;if(fr===row&&fc===0)rights[`${color}Q`]=false;if(fr===row&&fc===7)rights[`${color}K`]=false;}if(captured&&typeOf(captured)==="R"){const cc=colorOf(captured)!;const row=cc==="w"?7:0;if(tr===row&&tc===0)rights[`${cc}Q`]=false;if(tr===row&&tc===7)rights[`${cc}K`]=false;}return{board:nb,state:{castling:rights,enPassant:m.doubleStep?[(fr+tr)/2,fc] as Square:null,turn:opposite(s.turn),halfmove:type==="P"||captured?0:s.halfmove+1,fullmove:s.turn==="b"?s.fullmove+1:s.fullmove},captured,piece};}
export function legalMoves(b:Board,c:Color,s:GameState){const out:Move[]=[];for(let r=0;r<8;r++)for(let col=0;col<8;col++)if(colorOf(b[r][col])===c)for(const m of pseudoMovesForSquare(b,r,col,s)){const n=applyMove(b,s,m);if(!isInCheck(n.board,c))out.push(m);}return out;}
export function positionKey(b:Board,s:GameState){return`${b.map(row=>row.map(p=>p||"--").join("")).join("/")}|${s.turn}|${Object.entries(s.castling).filter(([,v])=>v).map(([k])=>k).join("")}|${s.enPassant?.join(",")||"-"}`;}
export function insufficientMaterial(b:Board){const pieces=b.flat().filter(Boolean) as Piece[];const non=pieces.filter(p=>typeOf(p)!=="K");if(non.length===0)return true;if(non.some(p=>["P","Q","R"].includes(typeOf(p)!)))return false;if(non.length<=1)return true;if(non.length===2&&non.every(p=>typeOf(p)==="N"))return true;if(non.every(p=>typeOf(p)==="B")){const colors=b.flatMap((row,r)=>row.map((p,c)=>p&&typeOf(p)==="B"?(r+c)%2:null)).filter((x):x is number=>x!==null);return colors.length>0&&colors.every(x=>x===colors[0]);}return false;}
export function getStatus(b:Board,s:GameState,repetition:Record<string,number>={}){const moves=legalMoves(b,s.turn,s);if(!moves.length)return isInCheck(b,s.turn)?"checkmate":"stalemate" as GameStatus;if(s.halfmove>=100)return"draw-50move";if((repetition[positionKey(b,s)]||0)>=3)return"draw-repetition";if(insufficientMaterial(b))return"draw-insufficient";return isInCheck(b,s.turn)?"check":"playing";}
export function notation(b:Board,m:Move,promotion:PieceType="Q",status?:GameStatus){const p=b[m.from[0]][m.from[1]]!;const type=typeOf(p)!;const suffix=status==="checkmate"?"#":status==="check"?"+":"";if(m.castle==="K")return`O-O${suffix}`;if(m.castle==="Q")return`O-O-O${suffix}`;return`${type==="P"?"":type}${m.capture?(type==="P"?FILES[m.from[1]]+"x":"x"):""}${squareName(...m.to)}${m.promotion?`=${promotion}`:""}${suffix}`;}
export function toFen(b:Board,s:GameState){const ranks=b.map(row=>{let empty=0,out="";for(const p of row){if(!p)empty++;else{if(empty)out+=empty;empty=0;out+=colorOf(p)==="w"?typeOf(p):typeOf(p)!.toLowerCase();}}if(empty)out+=empty;return out;}).join("/");let castling="";if(s.castling.wK)castling+="K";if(s.castling.wQ)castling+="Q";if(s.castling.bK)castling+="k";if(s.castling.bQ)castling+="q";return`${ranks} ${s.turn} ${castling||"-"} ${s.enPassant?squareName(...s.enPassant):"-"} ${s.halfmove} ${s.fullmove}`;}
export function evaluateBoard(b:Board){return b.reduce((score,row,r)=>score+row.reduce((sum,p,c)=>{if(!p)return sum;const sign=colorOf(p)==="w"?1:-1;return sum+sign*(PIECE_VALUE[typeOf(p)!]+([0,0,0,0,0,0,0,0][c]||0));},0),0);}
export function findBestMove(b:Board,s:GameState,color:Color,depth:number){const moves=legalMoves(b,color,s).sort((a,z)=>Number(!!z.capture)-Number(!!a.capture));if(!moves.length)return null;let best=moves[0],bestScore=color==="w"?-Infinity:Infinity;const search=(board:Board,state:GameState,d:number,alpha:number,beta:number):number=>{const status=getStatus(board,state);if(status==="checkmate")return state.turn==="w"?-100000-d:100000+d;if(status!=="playing"&&status!=="check")return 0;if(!d)return evaluateBoard(board);const next=legalMoves(board,state.turn,state);if(state.turn==="w"){let value=-Infinity;for(const m of next){const n=applyMove(board,state,m);value=Math.max(value,search(n.board,n.state,d-1,alpha,beta));alpha=Math.max(alpha,value);if(alpha>=beta)break;}return value;}let value=Infinity;for(const m of next){const n=applyMove(board,state,m);value=Math.min(value,search(n.board,n.state,d-1,alpha,beta));beta=Math.min(beta,value);if(alpha>=beta)break;}return value;};for(const m of moves){const n=applyMove(b,s,m);const score=search(n.board,n.state,Math.max(0,depth-1),-Infinity,Infinity);if(color==="w"?score>bestScore:score<bestScore){best=m;bestScore=score;}}return best;}
export const initialGame=():SerializedGame=>{const board=initialBoard(),state=initialState();return{board,state,history:[],captured:{w:[],b:[]},repetition:{[positionKey(board,state)]:1},lastMove:null};};
export const cloneGame=(g:SerializedGame):SerializedGame=>JSON.parse(JSON.stringify(g));
export function commitGameMove(g:SerializedGame,m:Move,promotion:PieceType="Q"){const next=cloneGame(g),result=applyMove(next.board,next.state,m,promotion);const status=getStatus(result.board,result.state,next.repetition);next.board=result.board;next.state=result.state;next.history=[...next.history,notation(g.board,m,promotion,status)];next.lastMove={from:m.from,to:m.to};if(result.captured){const c=colorOf(result.captured)!;next.captured={...next.captured,[c]:[...next.captured[c],result.captured]};}const key=positionKey(next.board,next.state);next.repetition={...next.repetition,[key]:(next.repetition[key]||0)+1};return{game:next,status,captured:result.captured};}
export const legalMovesForSquare=(g:SerializedGame,sq:Square)=>legalMoves(g.board,g.state.turn,g.state).filter(m=>sameSquare(m.from,sq));
export const statusLabel=(status:GameStatus,turn:Color)=>status==="checkmate"?`Checkmate · ${turn==="w"?"Black":"White"} wins`:status==="stalemate"?"Stalemate · Draw":status==="draw-50move"?"Draw · 50-move rule":status==="draw-repetition"?"Draw · Repetition":status==="draw-insufficient"?"Draw · Insufficient material":status==="check"?`Check · ${turn==="w"?"White":"Black"} to move`:`${turn==="w"?"White":"Black"} to move`;
export const isTerminal=(status:GameStatus)=>["checkmate","stalemate","draw-50move","draw-repetition","draw-insufficient"].includes(status);
export const serializeGame=(g:SerializedGame)=>JSON.stringify(g);
export const deserializeGame=(v:unknown)=>typeof v==="string"?JSON.parse(v) as SerializedGame:v as SerializedGame;
export const newRoomCode=()=>Math.random().toString(36).slice(2,8).toUpperCase();
export const normalizeRoomCode=(v:string)=>v.trim().toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8);
export const boardThemes=[{value:"classic-wood",label:"Classic Wood",colors:["#eadcc4","#744a36"]},{value:"midnight-obsidian",label:"Midnight Obsidian",colors:["#d8dce7","#354153"]},{value:"emerald-marble",label:"Emerald Marble",colors:["#e9e1c7","#35604d"]},{value:"royal-gold",label:"Royal Gold",colors:["#f3e6c2","#8c6329"]}];
export const pieceSets=[{value:"glyph",label:"Glyph"},{value:"classic",label:"Classic"},{value:"modern",label:"Modern"},{value:"3d",label:"3D-styled"}];
export const difficulties=[{value:1,label:"Casual"},{value:2,label:"Club"},{value:3,label:"Sharp"}];
export const modes=[{value:"ai",label:"Against AI"},{value:"local",label:"Local hot-seat"},{value:"online",label:"Online room"}];
export const getBoardColors=(theme:string):[string,string]=>boardThemes.find(t=>t.value===theme)?.colors as [string,string]||boardThemes[0].colors as [string,string];
export const colorName=(c:Color)=>c==="w"?"White":"Black";
export const statusTone=(s:GameStatus)=>s==="checkmate"?"danger":s==="check"?"warning":s.startsWith("draw")||s==="stalemate"?"muted":"active";
export const statusMessage=(g:SerializedGame,thinking=false)=>thinking?"Opponent is thinking…":statusLabel(getStatus(g.board,g.state,g.repetition),g.state.turn);
export const getCapturedScore=(c:{w:Piece[];b:Piece[]})=>({white:c.b.reduce((n,p)=>n+PIECE_VALUE[typeOf(p)!],0),black:c.w.reduce((n,p)=>n+PIECE_VALUE[typeOf(p)!],0)});
export const formatMovePairs=(h:string[])=>Array.from({length:Math.ceil(h.length/2)},(_,i)=>({number:i+1,white:h[i*2]||"",black:h[i*2+1]||""}));
export const isGameOver=(g:SerializedGame)=>isTerminal(getStatus(g.board,g.state,g.repetition));
export const moveFromSquares=(g:SerializedGame,from:Square,to:Square)=>legalMovesForSquare(g,from).find(m=>sameSquare(m.to,to))||null;
export const chooseAIMove=(g:SerializedGame,color:Color,difficulty:number)=>findBestMove(g.board,g.state,color,Math.max(1,Math.min(3,difficulty)));
export const getPieceDisplay=(p:Piece|null,style:string)=>!p?"":style==="modern"?typeOf(p)!:GLYPHS[p];
export const pieceName=(p:Piece)=>`${colorName(colorOf(p)!)} ${({P:"pawn",N:"knight",B:"bishop",R:"rook",Q:"queen",K:"king"} as Record<PieceType,string>)[typeOf(p)!]}`;
export const getGameStatus=(g:SerializedGame)=>getStatus(g.board,g.state,g.repetition);
export const getMovePair=(h:string[],i:number)=>({white:h[i*2]||"",black:h[i*2+1]||""});
export const getHistoryRows=(g:SerializedGame)=>Array.from({length:Math.ceil(g.history.length/2)},(_,i)=>({number:i+1,...getMovePair(g.history,i)}));
export const getWinner=(g:SerializedGame)=>{const s=getGameStatus(g);return s==="checkmate"?opposite(g.state.turn):null;};
export const getResultText=(g:SerializedGame)=>getWinner(g)?`${colorName(getWinner(g)!)} wins`:getGameStatus(g).startsWith("draw")||getGameStatus(g)==="stalemate"?"Draw":"In progress";
export const getGameTurnLabel=(g:SerializedGame)=>`${colorName(g.state.turn)} to move`;
export const getOpeningPhase=(g:SerializedGame)=>g.history.length<10?"Opening":g.history.length<40?"Middlegame":"Endgame";
export const getOpeningHint=(g:SerializedGame)=>g.history.length===0?"White moves first. Find your center.":g.history.length<6?"Develop pieces and keep your king safe.":"Look for forcing moves and tactical squares.";
export const getMaterialDelta=(g:SerializedGame)=>{const s=getCapturedScore(g.captured);return s.white-s.black;};
export const getModeActions=(mode:string,g:SerializedGame)=>({undo:mode!=="online"&&g.history.length>0,resign:!isGameOver(g),draw:(mode==="local"||mode==="online")&&!isGameOver(g)});
export const getModeDescription=(mode:string)=>mode==="ai"?"Practice with a responsive minimax opponent":mode==="local"?"Pass the board between two players":"Create a room and sync every move";
export const getModeLabel=(mode:string)=>mode==="ai"?"Against AI":mode==="local"?"Local hot-seat":"Online room";
export const getThemeLabel=(v:string)=>boardThemes.find(o=>o.value===v)?.label||"Walnut";
export const getPieceSetLabel=(v:string)=>pieceSets.find(o=>o.value===v)?.label||"Glyph";
export const getDifficultyLabel=(v:number)=>difficulties.find(o=>o.value===v)?.label||"Club";
export const getRoomStatusLabel=(s:string)=>s==="waiting"?"Waiting for opponent":s==="active"?"Live game":"Game finished";
export const getRoomCodeValid=(v:string)=>/^[A-Z0-9]{6,8}$/.test(normalizeRoomCode(v));
export const getRoomCodeDisplay=(v:string)=>normalizeRoomCode(v).split("").join(" ");
export const getBoardCoordinate=(r:number,c:number)=>({file:FILES[c],rank:8-r,name:squareName(r,c)});
export const getAriaLabel=(r:number,c:number,p:Piece|null)=>`${squareName(r,c)}${p?` ${pieceName(p)}`:" empty"}`;
export const getCapturedGlyphs=(g:SerializedGame,c:Color)=>g.captured[c].map(p=>GLYPHS[p]);
export const getGameOptions=()=>({modes,themes:boardThemes,pieces:pieceSets,difficulties});
export const getRoomOptions=()=>({codeLength:6,pollingMs:1500});
export const getGameMeta=(g:SerializedGame)=>({fen:toFen(g.board,g.state),status:getGameStatus(g),moves:g.history.length});
export const getDefaultPreferences=()=>({boardTheme:"classic-wood",pieceSet:"glyph"});
export const validTheme=(v:string)=>boardThemes.some(t=>t.value===v)?v:"classic-wood";
export const validPieceSet=(v:string)=>pieceSets.some(t=>t.value===v)?v:"glyph";
export const validMode=(v:string)=>modes.some(t=>t.value===v)?v:"ai";
export const validDifficulty=(v:number)=>difficulties.some(t=>t.value===v)?v:2;
export const gameToPayload=(g:SerializedGame)=>({gameState:g,history:g.history,fen:toFen(g.board,g.state),status:getGameStatus(g),turn:g.state.turn});
export const persistedState=(g:SerializedGame)=>({boardState:g,history:g.history,fen:toFen(g.board,g.state),turn:g.state.turn,status:getGameStatus(g)});
export const safeJson=<T,>(v:T)=>JSON.parse(JSON.stringify(v)) as T;
export const safeGame=(v:unknown):SerializedGame=>{try{const g=typeof v==="string"?JSON.parse(v):v as SerializedGame;return g&&Array.isArray(g.board)?g:initialGame();}catch{return initialGame();}};
export const formatClock=(seconds:number)=>`${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
export const boardRows=(c:Color)=>c==="w"?[0,1,2,3,4,5,6,7]:[7,6,5,4,3,2,1,0];
export const boardCols=(c:Color)=>c==="w"?[0,1,2,3,4,5,6,7]:[7,6,5,4,3,2,1,0];
export const toDisplaySquare=(c:Color,r:number,col:number):Square=>c==="w"?[r,col]:[7-r,7-col];
export const moveToUci=(m:Move)=>`${squareName(...m.from)}${squareName(...m.to)}`;
export const moveCount=(g:SerializedGame)=>g.history.length;
export const moveNumber=(g:SerializedGame)=>Math.floor(g.history.length/2)+1;
export const turnLabel=getGameTurnLabel;
export const appTitle=()=>"Knight's Gambit";
export const appTagline=()=>"A considered chess experience for the way you want to play.";
export const appVersion=()=>"1.0.0";
export const appHealth=()=>({engine:true,persistence:true,rooms:true});
export const featureFlags=()=>({rules:true,ai:true,local:true,online:true,history:true,controls:true,captured:true,persistence:true,themes:true,pieceSets:true});
export const engineName=()=>"Minimax · Knight's Gambit";
export const rulesSummary=()=>"Legal moves, check, checkmate, stalemate, castling, en passant, promotion, repetition, and 50-move draw";
export const onlineSummary=()=>"Persistent room state synchronized through join codes and polling";
export const roomPollingInterval=1500;
export const gameActions=(mode:string,g:SerializedGame)=>getModeActions(mode,g);
export const safePromotion=(v?:string):PieceType=>["Q","R","B","N"].includes(v||"")?v as PieceType:"Q";
export const isDrawStatus=(s:GameStatus)=>s==="stalemate"||s.startsWith("draw");
export const getStatusMessage=statusMessage;
export const getCurrentPosition=(g:SerializedGame)=>positionKey(g.board,g.state);
export const getLastMove=(g:SerializedGame)=>g.lastMove;
export const getGameHistory=(g:SerializedGame)=>g.history;
export const getGameBoard=(g:SerializedGame)=>g.board;
export const getGameState=(g:SerializedGame)=>g.state;
export const getGameCaptured=(g:SerializedGame)=>g.captured;
export const getGameRepetition=(g:SerializedGame)=>g.repetition;
export const getLegalTargets=(g:SerializedGame,sq:Square|null)=>sq?legalMovesForSquare(g,sq):[];
export const getGameStatusTone=(g:SerializedGame)=>statusTone(getGameStatus(g));
export const canUndo=(g:SerializedGame)=>g.history.length>0;
export const canResign=(g:SerializedGame)=>!isGameOver(g);
export const canOfferDraw=(mode:string,g:SerializedGame)=>getModeActions(mode,g).draw;
export const boardThemeValues=getBoardColors;
export const getChessMoveNotation=(g:SerializedGame,m:Move,p:PieceType="Q")=>notation(g.board,m,p);
