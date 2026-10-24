-- Radar Pro · o feed, a comunidade e o grupo passam a trazer quantos comentários cada item tem ('comentarios').
-- Mesmo conteúdo de antes, só com o campo novo. Rodar depois de 20261024_social_comentarios_mencoes_vou.sql.

create or replace function public.radar_feed(p_so_sigo boolean default false, p_limite integer default 80)
returns json language sql stable security definer set search_path to '' as $function$
with eu as (select auth.uid() as uid),
pub as (
  select p.user_id, p.apelido, p.foto_url, p.cidade, p.sexo from public.radar_perfis p
  where p.publico and (not p_so_sigo or p.user_id = (select uid from eu) or p.user_id in (select seguido from public.radar_segue where seguidor = (select uid from eu)))
),
ev as (
  select r.criado_em as quando, 'prova' as tipo, 'res:' || r.id as alvo, p.apelido, p.foto_url as foto, p.cidade,
    json_build_object('prova', r.prova_nome, 'data', r.prova_data, 'cidade', r.cidade, 'km', r.distancia_km, 'tempo', r.tempo_s, 'nota', r.nota, 'pontos', r.pontos,
      'geral', r.colocacao_geral, 'total', r.total_dist, 'podio', r.podio, 'recorde', coalesce((r.detalhes_pontos->>'recorde_pessoal')::int, 0) > 0,
      'medalhas', (select coalesce(json_agg(m.medalha), '[]'::json) from public.radar_medalhas m where m.resultado_id = r.id)) as dados
  from public.radar_resultados r join pub p on p.user_id = r.user_id where r.status in ('verificado', 'aprovado')
  union all
  select k.calculado_em, 'rei', 'rei:' || k.prova_id || ':' || k.distancia_km || ':' || k.sexo, p.apelido, p.foto_url, p.cidade,
    json_build_object('prova', k.prova_nome, 'data', k.prova_data, 'cidade', k.cidade, 'km', k.distancia_km, 'tempo', k.tempo_s, 'nota', k.nota, 'sexo', k.sexo, 'atletas', k.atletas)
  from public.radar_reis k join pub p on p.user_id = k.user_id
  union all
  select d.aceito_em, 'duelo', 'duelo:' || d.id, a.apelido, a.foto_url, a.cidade,
    json_build_object('adversario', b.apelido, 'foto_adv', b.foto_url, 'km', d.distancia_km, 'mes', d.mes)
  from public.radar_duelos d join pub a on a.user_id = d.desafiante join pub b on b.user_id = d.desafiado where d.aceito_em is not null and not d.oculto_feed
  union all
  select x.confirmado_em, 'x1', 'x1:' || x.id, v.apelido, v.foto_url, v.cidade,
    json_build_object('perdedor', l.apelido, 'foto_perdedor', l.foto_url, 'km', x.distancia_km, 'data', x.data, 'local', x.local,
      'tempo_v', least(x.tempo_criador, x.tempo_adv), 'tempo_p', greatest(x.tempo_criador, x.tempo_adv), 'empate', x.tempo_criador = x.tempo_adv,
      'nota_v', case when x.tempo_criador <= x.tempo_adv then x.nota_criador else x.nota_adv end,
      'nota_p', case when x.tempo_criador <= x.tempo_adv then x.nota_adv else x.nota_criador end)
  from public.radar_x1 x
  join public.radar_perfis v on v.publico and v.user_id = case when x.tempo_criador <= x.tempo_adv then x.criador else x.adversario end
  join public.radar_perfis l on l.publico and l.user_id = case when x.tempo_criador <= x.tempo_adv then x.adversario else x.criador end
  where x.status = 'confirmado' and not x.oculto_feed and (not p_so_sigo or v.user_id in (select user_id from pub) or l.user_id in (select user_id from pub))
  union all
  select o.criado_em, 'post', 'post:' || o.id, p.apelido, p.foto_url, p.cidade,
    json_build_object('id', o.id, 'texto', o.texto, 'foto', o.foto_url, 'meu', o.user_id = (select uid from eu))
  from public.radar_posts o join pub p on p.user_id = o.user_id where o.apagado_em is null and o.grupo is null and o.comunidade is null
)
select coalesce(json_agg(json_build_object('quando', e.quando, 'tipo', e.tipo, 'alvo', e.alvo, 'apelido', e.apelido, 'foto', e.foto, 'cidade', e.cidade, 'dados', e.dados,
    'reacoes', (select json_build_object('palma', count(*) filter (where x.tipo='palma'), 'fogo', count(*) filter (where x.tipo='fogo'), 'uau', count(*) filter (where x.tipo='uau')) from public.radar_aplausos x where x.alvo = e.alvo),
    'minha', (select x.tipo from public.radar_aplausos x where x.alvo = e.alvo and x.user_id = (select uid from eu)),
    'comentarios', (select count(*) from public.radar_comentarios c where c.alvo = e.alvo and c.apagado_em is null)
  ) order by e.quando desc), '[]'::json)
from (select * from ev order by quando desc limit greatest(1, least(p_limite, 200))) e;
$function$;

create or replace function public.radar_comunidade_feed(p_id text, p_limite integer default 80)
returns json language plpgsql stable security definer set search_path to '' as $function$
declare uid uuid := (select auth.uid()); res json;
begin
  if uid is null then raise exception 'Faça login'; end if;
  if not radar_priv.na_comunidade(uid, p_id) then raise exception 'Você não está nesta comunidade'; end if;
  select coalesce(json_agg(json_build_object('quando', o.criado_em, 'tipo', 'post', 'alvo', 'post:' || o.id, 'apelido', p.apelido, 'foto', p.foto_url, 'cidade', p.cidade,
      'dados', json_build_object('id', o.id, 'texto', o.texto, 'foto', o.foto_url, 'meu', o.user_id = uid, 'comunidade', o.comunidade),
      'reacoes', (select json_build_object('palma', count(*) filter (where x.tipo='palma'), 'fogo', count(*) filter (where x.tipo='fogo'), 'uau', count(*) filter (where x.tipo='uau')) from public.radar_aplausos x where x.alvo = 'post:' || o.id),
      'minha', (select x.tipo from public.radar_aplausos x where x.alvo = 'post:' || o.id and x.user_id = uid),
      'comentarios', (select count(*) from public.radar_comentarios c where c.alvo = 'post:' || o.id and c.apagado_em is null)
    ) order by o.criado_em desc), '[]'::json) into res
  from (select * from public.radar_posts o where o.apagado_em is null and o.comunidade = p_id order by o.criado_em desc limit greatest(1, least(p_limite, 200))) o
  join public.radar_perfis p on p.user_id = o.user_id and p.publico;
  return res;
end $function$;

create or replace function public.radar_feed_grupo(p_grupo text, p_limite integer default 80)
returns json language plpgsql stable security definer set search_path to '' as $function$
declare uid uuid := (select auth.uid()); meu text; res json;
begin
  if uid is null then raise exception 'Faça login'; end if;
  select sexo into meu from public.radar_perfis where user_id = uid;
  if meu is distinct from p_grupo then raise exception 'Este grupo é só de quem é do %', case when p_grupo = 'F' then 'feminino' else 'masculino' end; end if;
  select coalesce(json_agg(json_build_object('quando', o.criado_em, 'tipo', 'post', 'alvo', 'post:' || o.id, 'apelido', p.apelido, 'foto', p.foto_url, 'cidade', p.cidade,
      'dados', json_build_object('id', o.id, 'texto', o.texto, 'foto', o.foto_url, 'meu', o.user_id = uid, 'grupo', o.grupo),
      'reacoes', (select json_build_object('palma', count(*) filter (where x.tipo='palma'), 'fogo', count(*) filter (where x.tipo='fogo'), 'uau', count(*) filter (where x.tipo='uau')) from public.radar_aplausos x where x.alvo = 'post:' || o.id),
      'minha', (select x.tipo from public.radar_aplausos x where x.alvo = 'post:' || o.id and x.user_id = uid),
      'comentarios', (select count(*) from public.radar_comentarios c where c.alvo = 'post:' || o.id and c.apagado_em is null)
    ) order by o.criado_em desc), '[]'::json) into res
  from (select * from public.radar_posts o where o.apagado_em is null and o.grupo = p_grupo order by o.criado_em desc limit greatest(1, least(p_limite, 200))) o
  join public.radar_perfis p on p.user_id = o.user_id and p.publico;
  return res;
end $function$;
