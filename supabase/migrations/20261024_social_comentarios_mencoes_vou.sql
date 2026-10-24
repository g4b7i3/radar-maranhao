-- Radar Pro · rede social: comentários, menções (@apelido), "quem eu sigo vai" e sugestões de quem seguir.
-- Regras de apagar: cada pessoa apaga só o que ela escreveu; o admin (vinikautor@gmail.com) apaga de todo mundo.

-- ───────── Tabelas
create table if not exists public.radar_comentarios (
  id uuid primary key default gen_random_uuid(),
  alvo text not null check (alvo ~ '^(res|rei|duelo|post|x1):' and length(alvo) <= 120),
  user_id uuid not null references auth.users(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 1000),
  criado_em timestamptz not null default now(),
  apagado_em timestamptz,
  apagado_por uuid
);
create index if not exists radar_comentarios_alvo on public.radar_comentarios (alvo, criado_em) where apagado_em is null;
create index if not exists radar_comentarios_user on public.radar_comentarios (user_id, criado_em desc);
alter table public.radar_comentarios enable row level security;
revoke all on public.radar_comentarios from anon, authenticated;

create table if not exists public.radar_vou (
  user_id uuid not null references auth.users(id) on delete cascade,
  prova_id text not null check (prova_id ~ '^[a-z0-9-]{3,120}$'),
  prova_data date not null,
  criado_em timestamptz not null default now(),
  primary key (user_id, prova_id)
);
create index if not exists radar_vou_prova on public.radar_vou (prova_id);
alter table public.radar_vou enable row level security;
revoke all on public.radar_vou from anon, authenticated;

-- ───────── Quem pode ver um item do feed (para comentar, ler comentários e receber menção)
create or replace function radar_priv.pode_ver(uid uuid, p_alvo text)
returns boolean language plpgsql stable security definer set search_path to '' as $$
declare partes text[] := string_to_array(coalesce(p_alvo, ''), ':'); v uuid; o record;
begin
  if uid is null or array_length(partes, 1) < 2 then return false; end if;
  if partes[1] = 'rei' then
    return exists (select 1 from public.radar_reis k join public.radar_perfis p on p.user_id = k.user_id and p.publico
      where 'rei:' || k.prova_id || ':' || k.distancia_km || ':' || k.sexo = p_alvo);
  end if;
  begin v := partes[2]::uuid; exception when others then return false; end;
  if partes[1] = 'post' then
    select x.user_id, x.grupo, x.comunidade into o from public.radar_posts x join public.radar_perfis p on p.user_id = x.user_id and p.publico
      where x.id = v and x.apagado_em is null;
    if o.user_id is null then return false; end if;
    if o.comunidade is not null then return radar_priv.na_comunidade(uid, o.comunidade); end if;
    if o.grupo is not null then return o.grupo = (select p.sexo from public.radar_perfis p where p.user_id = uid); end if;
    return true;
  elsif partes[1] = 'res' then
    return exists (select 1 from public.radar_resultados r join public.radar_perfis p on p.user_id = r.user_id and p.publico where r.id = v and r.status in ('verificado', 'aprovado'));
  elsif partes[1] = 'duelo' then
    return exists (select 1 from public.radar_duelos d where d.id = v and d.aceito_em is not null and not d.oculto_feed);
  elsif partes[1] = 'x1' then
    return exists (select 1 from public.radar_x1 x where x.id = v and x.status = 'confirmado' and not x.oculto_feed);
  end if;
  return false;
end $$;

-- Donos de um item (quem recebe o aviso de comentário)
create or replace function radar_priv.donos(p_alvo text)
returns setof uuid language plpgsql stable security definer set search_path to '' as $$
declare partes text[] := string_to_array(coalesce(p_alvo, ''), ':'); v uuid;
begin
  if partes[1] = 'rei' then
    return query select k.user_id from public.radar_reis k where 'rei:' || k.prova_id || ':' || k.distancia_km || ':' || k.sexo = p_alvo; return;
  end if;
  begin v := partes[2]::uuid; exception when others then return; end;
  if partes[1] = 'post' then return query select user_id from public.radar_posts where id = v;
  elsif partes[1] = 'res' then return query select user_id from public.radar_resultados where id = v;
  elsif partes[1] = 'duelo' then return query select unnest(array[desafiante, desafiado]) from public.radar_duelos where id = v;
  elsif partes[1] = 'x1' then return query select unnest(array[criador, adversario]) from public.radar_x1 where id = v;
  end if;
end $$;

-- @apelidos citados num texto (até 10, só perfis que existem)
create or replace function radar_priv.mencionados(p_texto text)
returns setof uuid language sql stable security definer set search_path to '' as $$
  select p.user_id from (
    select distinct rtrim(lower(m[2]), '.') ap from regexp_matches(coalesce(p_texto, ''), '(^|[^a-zA-Z0-9_.@])@([a-zA-Z0-9_.]{3,21})', 'g') m
  ) x join public.radar_perfis p on p.apelido = x.ap
  limit 10;
$$;

-- Avisa os citados que podem ver o item (sem avisar quem escreveu e quem já foi avisado por outro motivo)
create or replace function radar_priv.avisar_mencoes(p_autor uuid, p_texto text, p_alvo text, p_chave text, p_onde text, p_menos uuid[] default '{}')
returns void language plpgsql security definer set search_path to '' as $$
declare quem text; u uuid;
begin
  select apelido into quem from public.radar_perfis where user_id = p_autor;
  for u in select radar_priv.mencionados(p_texto) loop
    if u = p_autor or u = any(p_menos) or not radar_priv.pode_ver(u, p_alvo) then continue; end if;
    insert into public.radar_avisos (user_id, tipo, titulo, corpo, url, chave)
    values (u, 'mencao', '@' || coalesce(quem, 'alguém') || ' citou você', 'Citou você ' || p_onde || ': "' || left(regexp_replace(p_texto, '\s+', ' ', 'g'), 120) || case when char_length(p_texto) > 120 then '…"' else '"' end,
      'https://radarcorridasma.com.br/?pro#feed/ver/' || p_alvo, p_chave)
    on conflict do nothing;
  end loop;
end $$;

-- Menção dentro de post: avisa na hora em que o post entra
create or replace function radar_priv.aviso_mencao_post()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if coalesce(new.texto, '') ~ '@' then
    perform radar_priv.avisar_mencoes(new.user_id, new.texto, 'post:' || new.id, 'mencao:post:' || new.id, 'num post');
  end if;
  return new;
end $$;
drop trigger if exists radar_posts_mencao on public.radar_posts;
create trigger radar_posts_mencao after insert on public.radar_posts for each row execute function radar_priv.aviso_mencao_post();

-- ───────── Comentários
create or replace function public.radar_comentarios(p_alvo text)
returns json language plpgsql stable security definer set search_path to '' as $$
declare uid uuid := (select auth.uid()); adm boolean := coalesce((select auth.jwt() ->> 'email'), '') = 'vinikautor@gmail.com';
begin
  if uid is null then raise exception 'Faça login'; end if;
  if not (adm or radar_priv.pode_ver(uid, p_alvo)) then raise exception 'Este item não está disponível'; end if;
  return (select coalesce(json_agg(json_build_object('id', c.id, 'apelido', p.apelido, 'foto', p.foto_url, 'texto', c.texto, 'quando', c.criado_em,
      'meu', c.user_id = uid, 'pode_apagar', c.user_id = uid or adm) order by c.criado_em), '[]'::json)
    from (select * from public.radar_comentarios where alvo = p_alvo and apagado_em is null order by criado_em limit 300) c
    join public.radar_perfis p on p.user_id = c.user_id);
end $$;

create or replace function public.radar_comentar(p_alvo text, p_texto text)
returns json language plpgsql security definer set search_path to '' as $$
declare uid uuid := (select auth.uid()); t text := btrim(coalesce(p_texto, '')); novo public.radar_comentarios; n int; quem text; donos uuid[]; u uuid; onde text;
begin
  if uid is null then raise exception 'Faça login'; end if;
  if not exists (select 1 from public.radar_perfis where user_id = uid) then raise exception 'Complete seu perfil antes de comentar'; end if;
  if t = '' then raise exception 'Escreva o comentário'; end if;
  if char_length(t) > 1000 then raise exception 'O comentário passa de 1000 caracteres'; end if;
  if not radar_priv.pode_ver(uid, p_alvo) then raise exception 'Este item não está disponível'; end if;
  select count(*) into n from public.radar_comentarios where user_id = uid and criado_em > now() - interval '1 day';
  if n >= 100 then raise exception 'Limite de 100 comentários por dia'; end if;
  select count(*) into n from public.radar_comentarios where user_id = uid and criado_em > now() - interval '1 minute';
  if n >= 6 then raise exception 'Calma: espere um minutinho para comentar de novo'; end if;
  insert into public.radar_comentarios (alvo, user_id, texto) values (p_alvo, uid, t) returning * into novo;
  -- avisa os donos do item
  select apelido into quem from public.radar_perfis where user_id = uid;
  onde := case split_part(p_alvo, ':', 1) when 'post' then 'no seu post' when 'res' then 'na sua prova' when 'rei' then 'no seu título de Rei/Rainha' else 'no seu duelo' end;
  select array_agg(distinct d) into donos from radar_priv.donos(p_alvo) d where d is not null;
  foreach u in array coalesce(donos, '{}') loop
    if u = uid then continue; end if;
    insert into public.radar_avisos (user_id, tipo, titulo, corpo, url, chave)
    values (u, 'comentario', '@' || coalesce(quem, 'alguém') || ' comentou ' || onde, left(regexp_replace(t, '\s+', ' ', 'g'), 140) || case when char_length(t) > 140 then '…' else '' end,
      'https://radarcorridasma.com.br/?pro#feed/ver/' || p_alvo, 'coment:' || novo.id)
    on conflict do nothing;
  end loop;
  -- avisa quem foi citado com @
  if t ~ '@' then perform radar_priv.avisar_mencoes(uid, t, p_alvo, 'mencao:coment:' || novo.id, 'num comentário', coalesce(donos, '{}')); end if;
  return json_build_object('id', novo.id, 'apelido', quem, 'foto', (select foto_url from public.radar_perfis where user_id = uid), 'texto', novo.texto, 'quando', novo.criado_em, 'meu', true, 'pode_apagar', true);
end $$;

create or replace function public.radar_comentario_apagar(p_id uuid)
returns boolean language plpgsql security definer set search_path to '' as $$
declare uid uuid := (select auth.uid()); adm boolean := coalesce((select auth.jwt() ->> 'email'), '') = 'vinikautor@gmail.com';
begin
  if uid is null then return false; end if;
  update public.radar_comentarios set apagado_em = now(), apagado_por = uid where id = p_id and apagado_em is null and (user_id = uid or adm);
  return found;
end $$;

-- ───────── "Eu vou" (só dentro do Pro) e quem eu sigo vai
create or replace function public.radar_vou_marcar(p_prova text, p_data date, p_vou boolean)
returns json language plpgsql security definer set search_path to '' as $$
declare uid uuid := (select auth.uid()); hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if uid is null then raise exception 'Faça login'; end if;
  if coalesce(p_prova, '') !~ '^[a-z0-9-]{3,120}$' then raise exception 'Prova inválida'; end if;
  if p_vou then
    if p_data is null or p_data < hoje or p_data > hoje + 500 then raise exception 'Só dá para marcar provas que ainda vão acontecer'; end if;
    if not exists (select 1 from public.radar_perfis where user_id = uid) then raise exception 'Complete seu perfil antes'; end if;
    if (select count(*) from public.radar_vou where user_id = uid and prova_data >= hoje) >= 60 then raise exception 'Limite de 60 provas marcadas'; end if;
    insert into public.radar_vou (user_id, prova_id, prova_data) values (uid, p_prova, p_data) on conflict (user_id, prova_id) do update set prova_data = excluded.prova_data;
  else
    delete from public.radar_vou where user_id = uid and prova_id = p_prova;
  end if;
  return public.radar_quem_vai(p_prova);
end $$;

create or replace function public.radar_quem_vai(p_prova text)
returns json language sql stable security definer set search_path to '' as $$
  with eu as (select auth.uid() uid),
  vao as (
    select p.apelido, p.foto_url foto, p.cidade, v.criado_em,
      exists (select 1 from public.radar_segue s where s.seguidor = (select uid from eu) and s.seguido = v.user_id) sigo
    from public.radar_vou v join public.radar_perfis p on p.user_id = v.user_id and p.publico
    where v.prova_id = p_prova and v.user_id <> (select uid from eu)
  )
  select json_build_object(
    'eu', exists (select 1 from public.radar_vou v where v.prova_id = p_prova and v.user_id = (select uid from eu)),
    'total', (select count(*) from vao),
    'sigo', (select coalesce(json_agg(json_build_object('apelido', apelido, 'foto', foto, 'cidade', cidade) order by criado_em), '[]'::json) from vao where sigo),
    'outros', (select coalesce(json_agg(json_build_object('apelido', apelido, 'foto', foto, 'cidade', cidade)), '[]'::json) from (select * from vao where not sigo order by foto is null, criado_em desc limit 12) o)
  ) where (select uid from eu) is not null;
$$;

-- ───────── Sugestões de quem seguir: mesmas provas, mesma assessoria, mesma cidade, seguidos por quem você segue
create or replace function public.radar_sugestoes_seguir()
returns json language sql stable security definer set search_path to '' as $$
  with eu as (select p.user_id uid, p.cidade, p.assessoria from public.radar_perfis p where p.user_id = auth.uid()),
  sigo as (select seguido from public.radar_segue where seguidor = (select uid from eu)),
  cand as (
    select p.user_id, p.apelido, p.foto_url, p.cidade, p.assessoria, p.visto_em from public.radar_perfis p
    where p.publico and p.user_id <> (select uid from eu) and p.user_id not in (select seguido from sigo)
  ),
  pontos as (
    select c.*,
      (select count(distinct r2.prova_id) from public.radar_resultados r1 join public.radar_resultados r2 on r2.prova_id = r1.prova_id
        where r1.user_id = (select uid from eu) and r2.user_id = c.user_id and r1.status in ('verificado','aprovado') and r2.status in ('verificado','aprovado'))::int provas,
      (select count(*) from public.radar_vou v1 join public.radar_vou v2 on v2.prova_id = v1.prova_id
        where v1.user_id = (select uid from eu) and v2.user_id = c.user_id and v1.prova_data >= current_date)::int vao_juntos,
      (select count(*) from public.radar_segue s where s.seguido = c.user_id and s.seguidor in (select seguido from sigo))::int em_comum,
      (select min(p2.apelido) from public.radar_segue s join public.radar_perfis p2 on p2.user_id = s.seguidor where s.seguido = c.user_id and s.seguidor in (select seguido from sigo)) um_comum,
      exists (select 1 from public.radar_segue s where s.seguidor = c.user_id and s.seguido = (select uid from eu)) me_segue,
      (c.assessoria is not null and c.assessoria = (select assessoria from eu)) mesma_assessoria,
      (lower(c.cidade) = lower((select cidade from eu))) mesma_cidade
    from cand c
  ),
  nota as (
    select *, provas * 4 + vao_juntos * 2 + em_comum * 2 + (case when me_segue then 3 else 0 end) + (case when mesma_assessoria then 3 else 0 end) + (case when mesma_cidade then 1 else 0 end) + (case when foto_url is not null then 1 else 0 end) pts
    from pontos
  )
  select coalesce(json_agg(json_build_object('apelido', apelido, 'foto', foto_url, 'cidade', cidade,
      'motivo', case when me_segue then 'Segue você'
        when provas > 0 then case when provas = 1 then 'Correu a mesma prova que você' else 'Correu ' || provas || ' provas com você' end
        when vao_juntos > 0 then 'Vai na mesma prova que você'
        when mesma_assessoria then 'Da sua assessoria'
        when em_comum > 0 then 'Seguido por @' || um_comum || case when em_comum > 1 then ' e mais ' || (em_comum - 1) else '' end
        when mesma_cidade then 'De ' || cidade
        else 'Corre no Radar' end) order by pts desc, visto_em desc nulls last), '[]'::json)
  from (select * from nota where (select uid from eu) is not null order by pts desc, visto_em desc nulls last limit 10) n;
$$;

-- ───────── Um item só do feed (abre pela notificação de comentário ou menção)
create or replace function public.radar_item(p_alvo text)
returns json language plpgsql stable security definer set search_path to '' as $$
declare uid uuid := (select auth.uid()); adm boolean := coalesce((select auth.jwt() ->> 'email'), '') = 'vinikautor@gmail.com';
  partes text[] := string_to_array(coalesce(p_alvo, ''), ':'); v uuid; res json;
begin
  if uid is null then raise exception 'Faça login'; end if;
  if not (adm or radar_priv.pode_ver(uid, p_alvo)) then return null; end if;
  if partes[1] = 'rei' then
    select json_build_object('quando', k.calculado_em, 'tipo', 'rei', 'alvo', p_alvo, 'apelido', p.apelido, 'foto', p.foto_url, 'cidade', p.cidade,
      'dados', json_build_object('prova', k.prova_nome, 'data', k.prova_data, 'cidade', k.cidade, 'km', k.distancia_km, 'tempo', k.tempo_s, 'nota', k.nota, 'sexo', k.sexo, 'atletas', k.atletas)) into res
    from public.radar_reis k join public.radar_perfis p on p.user_id = k.user_id
    where 'rei:' || k.prova_id || ':' || k.distancia_km || ':' || k.sexo = p_alvo limit 1;
  else
    begin v := partes[2]::uuid; exception when others then return null; end;
    if partes[1] = 'post' then
      select json_build_object('quando', o.criado_em, 'tipo', 'post', 'alvo', p_alvo, 'apelido', p.apelido, 'foto', p.foto_url, 'cidade', p.cidade,
        'dados', json_build_object('id', o.id, 'texto', o.texto, 'foto', o.foto_url, 'meu', o.user_id = uid, 'comunidade', o.comunidade, 'grupo', o.grupo)) into res
      from public.radar_posts o join public.radar_perfis p on p.user_id = o.user_id where o.id = v and o.apagado_em is null;
    elsif partes[1] = 'res' then
      select json_build_object('quando', r.criado_em, 'tipo', 'prova', 'alvo', p_alvo, 'apelido', p.apelido, 'foto', p.foto_url, 'cidade', p.cidade,
        'dados', json_build_object('prova', r.prova_nome, 'data', r.prova_data, 'cidade', r.cidade, 'km', r.distancia_km, 'tempo', r.tempo_s, 'nota', r.nota, 'pontos', r.pontos,
          'geral', r.colocacao_geral, 'total', r.total_dist, 'podio', r.podio, 'recorde', coalesce((r.detalhes_pontos->>'recorde_pessoal')::int, 0) > 0,
          'medalhas', (select coalesce(json_agg(m.medalha), '[]'::json) from public.radar_medalhas m where m.resultado_id = r.id))) into res
      from public.radar_resultados r join public.radar_perfis p on p.user_id = r.user_id where r.id = v;
    elsif partes[1] = 'duelo' then
      select json_build_object('quando', d.aceito_em, 'tipo', 'duelo', 'alvo', p_alvo, 'apelido', a.apelido, 'foto', a.foto_url, 'cidade', a.cidade,
        'dados', json_build_object('adversario', b.apelido, 'foto_adv', b.foto_url, 'km', d.distancia_km, 'mes', d.mes)) into res
      from public.radar_duelos d join public.radar_perfis a on a.user_id = d.desafiante join public.radar_perfis b on b.user_id = d.desafiado where d.id = v;
    elsif partes[1] = 'x1' then
      select json_build_object('quando', x.confirmado_em, 'tipo', 'x1', 'alvo', p_alvo, 'apelido', w.apelido, 'foto', w.foto_url, 'cidade', w.cidade,
        'dados', json_build_object('perdedor', l.apelido, 'foto_perdedor', l.foto_url, 'km', x.distancia_km, 'data', x.data, 'local', x.local,
          'tempo_v', least(x.tempo_criador, x.tempo_adv), 'tempo_p', greatest(x.tempo_criador, x.tempo_adv), 'empate', x.tempo_criador = x.tempo_adv,
          'nota_v', case when x.tempo_criador <= x.tempo_adv then x.nota_criador else x.nota_adv end,
          'nota_p', case when x.tempo_criador <= x.tempo_adv then x.nota_adv else x.nota_criador end)) into res
      from public.radar_x1 x
      join public.radar_perfis w on w.user_id = case when x.tempo_criador <= x.tempo_adv then x.criador else x.adversario end
      join public.radar_perfis l on l.user_id = case when x.tempo_criador <= x.tempo_adv then x.adversario else x.criador end
      where x.id = v;
    end if;
  end if;
  if res is null then return null; end if;
  return (res::jsonb || jsonb_build_object(
    'reacoes', (select json_build_object('palma', count(*) filter (where x.tipo='palma'), 'fogo', count(*) filter (where x.tipo='fogo'), 'uau', count(*) filter (where x.tipo='uau')) from public.radar_aplausos x where x.alvo = p_alvo),
    'minha', (select x.tipo from public.radar_aplausos x where x.alvo = p_alvo and x.user_id = uid),
    'comentarios', (select count(*) from public.radar_comentarios c where c.alvo = p_alvo and c.apagado_em is null)))::json;
end $$;

-- ───────── Permissões: só quem está logado chama
revoke all on function public.radar_comentarios(text), public.radar_comentar(text, text), public.radar_comentario_apagar(uuid),
  public.radar_vou_marcar(text, date, boolean), public.radar_quem_vai(text), public.radar_sugestoes_seguir(), public.radar_item(text) from public, anon;
grant execute on function public.radar_comentarios(text), public.radar_comentar(text, text), public.radar_comentario_apagar(uuid),
  public.radar_vou_marcar(text, date, boolean), public.radar_quem_vai(text), public.radar_sugestoes_seguir(), public.radar_item(text) to authenticated;
revoke all on function radar_priv.pode_ver(uuid, text), radar_priv.donos(text), radar_priv.mencionados(text),
  radar_priv.avisar_mencoes(uuid, text, text, text, text, uuid[]), radar_priv.aviso_mencao_post() from public, anon, authenticated;
