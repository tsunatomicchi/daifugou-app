// Test-only room API. Not included in the distributable ZIP.
(() => {
  const query = new URLSearchParams(location.search);
  const id = query.get('id') || 'u0';
  const admin = id === 'u0';
  const state = {};
  const callbacks = new Map();
  const bus = new BroadcastChannel('daifugou-display-check');
  const profile = {displayName: admin ? '管理者' : `参加者 ${id.slice(1)}`, avatarId: ''};
  const record = () => ({entryState:'room',profile,permissions:{kick_users:admin}});
  const announce = hello => {
    state[id] = {metas:[record()]};
    bus.postMessage({kind:'presence',sender:id,meta:record(),hello});
  };
  bus.onmessage = ({data:packet}) => {
    if (packet.sender === id) return;
    if (packet.kind === 'presence') {
      state[packet.sender] = {metas:[packet.meta]};
      if (packet.hello) announce(false);
    } else if (packet.kind === 'data') {
      // Exercise v0.3.2's recipient guard even when an adapter fans packets out.
      callbacks.get(packet.channel)?.(packet.sender,packet.channel,structuredClone(packet.data));
    } else if (packet.kind === 'bye') delete state[packet.sender];
  };
  const hub = new EventTarget();
  hub.presence = {state};
  hub.can = permission => admin && permission === 'kick_users';
  hub.userCan = (peer,permission) => state[peer]?.metas?.[0]?.permissions?.[permission] === true;
  globalThis.APP = {hubChannel:hub};
  const send = (target,channel,data) => {
    bus.postMessage({kind:'data',sender:id,target,channel,data:structuredClone(data)});
    if (target !== '*') callbacks.get(channel)?.(id,channel,structuredClone(data));
  };
  globalThis.NAF = {clientId:id,connection:{
    subscribeToDataChannel:(channel,callback)=>callbacks.set(channel,callback),
    unsubscribeToDataChannel:channel=>callbacks.delete(channel),
    sendDataGuaranteed:(target,channel,data)=>send(target,channel,data),
    broadcastDataGuaranteed:(channel,data)=>send('*',channel,data)
  }};
  announce(true);
  const timer = setInterval(()=>announce(false),1000);
  addEventListener('beforeunload',()=>{clearInterval(timer);bus.postMessage({kind:'bye',sender:id});bus.close();});
})();
