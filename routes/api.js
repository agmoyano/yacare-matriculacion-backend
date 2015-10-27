
module.exports = function(config) {
	var express = require('express');
	var router = express.Router();
	var pg = require('pg.js');
	var fs = require('fs');
	var path = require('path');
	var async = require('async');
	var xml2json = require('xml2json');
	var uuid = require('uuid');
	var jasper = require('node-jasper')({
		path: path.resolve(__dirname, '..', 'lib', 'jasperreports-6.0.0'),
		reports: {
			pr: {
				jasper: path.resolve(__dirname, '..', 'report', 'report1.jasper'),
				conn: 'yacare'
			}
		},
		drivers: {
			pg: {
				path: path.resolve(__dirname, '..', 'lib', 'postgresql-9.1-903.jdbc4.jar'),
				class: 'org.postgresql.Driver',
				type: 'postgresql'
			}
		},
		conns: {
			yacare: {
				host: config.pg.host,
				user: config.pg.user,
				pass: config.pg.pass,
				port: config.pg.port,
				dbname: config.pg.db,
				driver: 'pg'
			}
		}
	});

	router.post('/matricula', function(req, res, next) {
		var client = new pg.Client(config.pg.connStr);
		client.connect(function(err) {
			if(err) return next(err);
			async.series([
				/**primer objeto del arreglo***/
				function(cb) {
					console.log('inicio tran');
					client.query('begin work', cb);
				},
				/**segundo objeto del arreglo***/
				function(cb) {
					var mat = req.body.matricula;
					var sql;
					sql = "INSERT INTO yacare.enrollment " +
					"(id, state_enable, created_date, " +
						"record, admission_act_id, type_state_enrolled_id, " +
						"state_lc) " +
					"select $1, true, now(), false, a.id, (SELECT id FROM yacare.type_state_enrolled WHERE code = '1'), 'D' "+
					"from 	yacare.admission_act a "+
					"left join "+
					"		yacare.enrollment e "+
					"on		a.id = e.admission_act_id "+
					" 		and e.state_enable = true "+
					"where 	a.id = $2 "+
					"		and e.id is null ";
					var params = [uuid.v4(), mat.id];
					console.log(sql);
					console.log(params);
					client.query(sql, params, cb);
				}
			],
			/** segundo argumento de la funcion series **/
			function(err, result) {
				if(err) {
					console.log(err);
					return client.query('rollback work', function() {
						client.end();
						next(err);
					});
	 			} //cierro if
 				client.query('commit work', function(err, result) {
 					client.end();
 					res.json({status: 'ok', message: 'La matricula ha sido generada.'});
 				});
			} /**cierro segundo argumento**/
   			); //cierra funcion sieres
      	 }); ///cierro connect
	});

	router.get('/report', function(req, res, next) {
		if(!req.session.uid)
			return next({status: 401, message: 'No esta autorizado para realizar esta acción.'});
		var pdf = jasper.pdf({report: 'pr', data: {id: req.session.uid, base: '../photos'}});
		res.set({
			'Content-type': 'application/pdf',
			'Content-Length': pdf.length
		});
		res.send(pdf);
    }); //cieerro get

	router.get('/logout', function(req, res, next) {
		console.log('pre-session: '+JSON.stringify(req.session));
		req.session.destroy();
		console.log('session: '+JSON.stringify(req.session));
		res.send({status: 'ok', message: 'sesion destruida'});
	});

	router.post('/login', function(req, res, next) {
		if(!req.body.doc/*||!req.body.nombre||!req.body.apellido||!req.body.dni*/) return next({status: 400, message: 'Faltan parámetros obligatorios.'});
		req.body['pp.identification_number'] = req.body.doc;
		delete req.body.doc;

		var params=[],
			sql_add=[], 
			n=1;
		
		console.log(req.body);
		for(var i in req.body) {
			params.push(req.body[i]);
			sql_add.push("regexp_replace(lower("+i+"), E'\\\\.', '', 'g') = regexp_replace(lower($"+n+"), '\\\\.', '', 'g')");
			n++;
		}

		/*if(params.length < 3) {
			return next({status: 400, message: 'Debe contestar al menos 2 preguntas sobre un tutor.'});
		}*/
		var client = new pg.Client(config.pg.connStr);
		console.log(config.pg.connStr);
		client.connect(function(err) {
			if(err) {
				console.log(err);
				return next(err);
			}
			var sql = fs.readFileSync(path.resolve(__dirname, '../sql', 'datos_estudiantes.sql')).toString()+' where '+sql_add.join(' and ');
			console.log(sql);
			client.query(sql, params, function(err, result) {
				client.end();
				console.log('algo '+result);
				if(err) {
					console.log(err);
					return next(err);
				}
				if(result&&result.rows.length) {

					req.session.uid = result.rows[0].physical_person_id;
					console.log('post-session: '+JSON.stringify(req.session));
					res.json({status: 'ok', message: 'Válido'});
				} else {
					next({status: 401, message: 'Los datos ingresados no coinciden con los registros.'});
				}
			});
		});
	});


	router.get('/dominios', function(req, res, next) {
		var client = new pg.Client(config.pg.connStr);
		client.connect(function(err) {
			if(err) return next(err);
			var dominiosModel = {
				pais: 
					'select id as key, name as val, citizenship as nac '+
					'from	yacare.country '+
					'where	state_enable = true '+
					'order by 2',
				provincia: 
					'select id as key, name as val, country_id as parent '+
					'from 	yacare.state_country '+
					'where 	state_enable = true '+
				   	'order by 2',
				departamento: 
					'select id as key, name as val, state_country_id as parent '+
				   	'from	yacare.department_state_country '+
					'where 	state_enable = true '+
					'order by 2',
				ciudad: 
					'select c.id as key, c.name as val, state_country_id as parent '+
					'from	yacare.city c '+
					'inner join '+
					'		yacare.department_state_country dsc '+
					'on 	dsc.id = c.department_state_country_id '+
					'where 	c.state_enable = true '+
					'		and dsc.state_enable = true '+
					'order by 2',
				ciudad_nacimiento: 
					'select c.id as key, c.name as val, sc.country_id as parent '+
		   			'from	yacare.city c '+
		   			'inner join '+
		   			'		yacare.department_state_country dsc '+
		   			'on 	c.department_state_country_id = dsc.id '+
		   			'inner join '+
		   			'		yacare.state_country sc '+
		   			'on 	dsc.state_country_id = sc.id '+
					'where 	c.state_enable = true '+
					'		and sc.state_enable = true '+
					'		and dsc.state_enable = true '+
			   		'order by 2'
				,
				ciudades_cordoba: 
					'select c.id as key, c.name as val '+
	   				'from	yacare.city c '+
	   				'inner join '+
	   				'		yacare.department_state_country dsc '+
	   				'on 	c.department_state_country_id = dsc.id '+
	   				'inner join '+
	   				'		yacare.state_country sc '+
	   				'on 	dsc.state_country_id = sc.id '+
	   				'inner join '+
	   				'		yacare.country ct '+
	   				'on 	sc.country_id = ct.id '+
					'where 	c.state_enable = true '+
					'		and sc.state_enable = true '+
					'		and dsc.state_enable = true '+
					'		and ct.state_enable = true '+
					'		and ct.name = \'Argentina\' '+
					'		and sc.name = \'Córdoba\' '+
		   			'order by 2',
				relacion_familiar: 
					'select id as key, name as val '+
				   	'from	yacare.family_relationship_type '+
				   	'where 	state_enable = true '+
					//'		and legal_responsibility=true '+
		   			'order by 2',
				grupo_sanguineo: 
					'select id as key, name as val '+
					'from 	yacare.blood_group '+
					'		where state_enable = true '+
					'order by 2',
				factor_sanguineo: 
					'select id as key, name as val '+
					'from 	yacare.blood_factor '+
					'		where state_enable = true '+
					'order by 2',
				tipo_documento:
					'select id as key, name as val '+
					'from 	yacare.identification_type_person '+
					'		where state_enable = true '+
					'order by 2'
			};

			var mkDom = function(obj, cb, params) {
				var rows = [];
				if(typeof obj == 'string') {
					obj = {sql: obj};
				} 
				if(obj.sql) {
					client.query(obj.sql, params||[], function(err, result) {
						if(err) return cb(err);
						delete obj.sql;
						rows = result.rows;
						var keys = Object.keys(obj);
						async.each(keys, function(key, cb) {
							var child = obj[key];
							async.each(rows, function(row, cb) {
								mkDom(child, function(err, result) {
									row[key] = result;
									cb(err);
								}, [row.key]);
							}, cb);
						}, function(err) {
							/*var rowsObj = {};
							rows.forEach(function(item) {
								rowsObj[item.key] = item
							});*/
							cb(err, rows);//Obj);
						});
					});
				} else {
					cb('Objeto sin sql');
				}
			};

			var dominios = {};
			async.each(Object.keys(dominiosModel), function(key, cb){
				var obj = dominiosModel[key];
												
				mkDom(obj, function(err, dom) {
					if(err) return cb(err);
					dominios[key] = dom;
					cb();
				});
			}, function(err, result){
				client.end();
				if(err) return next(err);
				res.json(dominios);
			});
		});
	});


	router.get('/alumno', function(req, res, next) {
		if(!req.session.uid) return next({status: 401, message: 'No esta autorizado para realizar esta acción.'});
		var client = new pg.Client(config.pg.connStr);
		client.connect(function(err) {
			if(err) return next(err);
			var sql = fs.readFileSync(path.resolve(__dirname, '../sql', 'datos_estudiantes.sql')).toString()+" where	pp.id = $1 ";
			client.query(sql, [req.session.uid], function(err, result) {
				client.end();
				if(err||!result||!result.rows.length) return next(err||{status: 401, message: 'No esta autorizado para realizar esta acción.'});
				var data = result.rows[0];
				//data.nacimiento&&(data.nacimiento=JSON.parse(data.nacimiento));
				//data.lugar_nacimiento&&(data.lugar_nacimiento=JSON.parse(data.lugar_nacimiento));
				var finalObj={};
				var model = {
					alumno: [
						'nombre', 
						'apellido', 
						'tipo_documento',
						'tipo_documento_id', 
						'nro_documento', 
						'nro_cuil', 
						'genero', 
						'grupo_sanguineo', 
						'grupo_sanguineo_id',
						'factor_rh',
						'factor_rh_id', 
						'nac', 
						'lugar_nacimiento', 
						'nacionalidad'
					],
					direccion_actual: [
						{m: 'id', d: 'address_add_pers_id'},
						{m: 'barrio', d: 'barrio_dom_actual'},
						{m: 'calle', d: 'calle_actual'},
						{m: 'nro', d: 'nro_dom_actual'},
						{m: 'ciudad_id', d: 'city_dom_actual_id'},
						{m: 'ciudad', d: 'city_dom_actual'},
						{m: 'piso', d: 'piso_dom_actual'},
						{m: 'depto', d: 'flat_dom_actual'},
						{m: 'edificio', d: 'edificio_dom_actual'},
						{m: 'cp', d: 'codigo_postal_dom_actual'},
            			{m:'comment', d: 'comentario_dom_actual'}
					],
					matricula: [
						{m: 'anio', d: 'year_admission'},
						'turno',
						'turno_id',
						{m: 'id', d: 'last_adm_id'},
						'period_id',
						'period'
					]
				};
				for(var i in model) {
					finalObj[i] = {};
					model[i].forEach(function(item) {
						if(typeof item == 'string') {
							finalObj[i][item] = data[item];
						} else {
							finalObj[i][item.m] = data[item.d];
						}
					});

				}
			
				finalObj.imagenActual = data.foto?"/photos/"+data.foto.substr(0,1)+"/"+data.foto:"images/default-male.png";

				res.json(finalObj);
			});			
		});
	});

	router.get('/tutor', function(req, res, next) {
		if(!req.session.uid) return next({status: 401, message: 'No esta autorizado para realizar esta acción.'});
		var client = new pg.Client(config.pg.connStr);
		client.connect(function(err) {
			if(err) return next(err);
			var sql = fs.readFileSync(path.resolve(__dirname, '../sql', 'tutores.sql')).toString()+' where pp.id = $1';
			client.query(sql, [req.session.uid], function(err, result) {
				client.end();
				if(err) return next(err);
				var finalArr = [];
				result.rows.forEach(function(data) {
					//data.nacimiento&&(data.nacimiento=JSON.parse(data.nacimiento));
					//data.lugar_nacimiento&&(data.lugar_nacimiento=JSON.parse(data.lugar_nacimiento));
					console.log(data);

					var model = {
						id: data.tutor_id,
						nombre: data.nombre, 
						apellido: data.apellido,
						tipo_relacion_id: data.id_rel_fam,
						tipo_relacion: data.name_rel_fam,
						tipo_documento: data.tipo_documento,
						tipo_documento_id: data.tipo_documento_id, 
						nro_documento: data.dni, 
						nro_cuil: data.nro_cuil, 
						genero: data.genero, 
						grupo_sanguineo: data.grupo_sanguineo, 
						grupo_sanguineo_id: data.grupo_sanguineo_id,
						factor_rh: data.factor_rh, 
						factor_rh_id: data.factor_rh_id, 
						fecha_nacimiento: data.fecha_nacimiento,
						lugar_nacimiento: data.pais_nacimiento, 
						nacionalidad: data.nacionalidad_id,
						mail: data.email,
						mail_id: data.email_id,
						telefono: data.phone,
						telefono_id: data.phone_id
					}

					if(data.calle_actual) {
						model.direccion_actual = {
							id: data.address_add_pers_id,
							calle: data.calle_actual,
							nro: data.nro_dom_actual,
							barrio: data.barrio_dom_actual,
						    edificio: data.edificio_dom_actual,
						    piso: data.piso_dom_actual,
						    depto: data.flat_dom_actual,
						    ciudad_id: data.city_dom_actual_id,
						    ciudad: data.city_dom_actual,
						    provincia: data.provincia_dom_actual,
						    provincia_id: data.provincia_dom_actual_id,
						    pais: data.pais_dom_actual,
						    pais_id: data.pais_dom_actual_id,
						    cp: data.cp_dom_actual,
                			comentario: data.comentario_dom_actual
						};
					}

					finalArr.push(model);
				});
				res.json(finalArr);
			});
		});
	});

	router.get('/emergencia', function(req, res, next) {
		if(!req.session.uid) return next({status: 401, message: 'No esta autorizado para realizar esta acción.'});
		var client = new pg.Client(config.pg.connStr);
		client.connect(function(err) {
			if(err) return next(err);
			var sql = fs.readFileSync(path.resolve(__dirname, '../sql', 'telefonos.sql')).toString();
			client.query(sql, [req.session.uid], function(err, result) {
				client.end();
				if(err) return next(err);
				result.rows.forEach(function(item) {		
					console.log(item);			
					item.xml= item.comentario?JSON.parse(xml2json.toJson(item.comentario)).contact:{};
					console.log(item);
				});
				res.json(result.rows);
			});
		});
	});

	router.post('/guardar', function(req, res, next) {
		if(!req.session.uid) return next({status: 401, message: 'No esta autorizado para realizar esta acción.'});
		console.log(req.body);
		var client = new pg.Client(config.pg.connStr);
		client.connect(function(err) {
			if(err) return next(err);
			async.series([
			function(cb) {
				console.log('inicio tran');
				client.query('begin work', cb);
			},
			function(cb) {
				console.log('inicio guardado');
			async.each(Object.keys(req.body), function(item, cb) {
				console.log(item);
				switch(item) {
					case "alumno":
						var alu = req.body.alumno;
						var sql =
							"UPDATE  yacare.physical_person "+
							"SET last_name=$2, name=$3, masculine=$4, birth_date=$5, "+
							"identification_type_person_id=$6, identification_number=$7, "+
							"country_id=$8, nationality_country_id=$9, "+
							"blood_group_id=$10, blood_factor_id=$11 "+
							"WHERE id=$1";
						var params = [
							req.session.uid, 
							alu.apellido, 
							alu.nombre, 
							alu.genero=='Hombre', 
							alu.nac, 
							alu.tipo_documento_id, 
							alu.nro_documento, 
							alu.lugar_nacimiento, 
							alu.nacionalidad, 
							alu.grupo_sanguineo_id, 
							alu.factor_rh_id
						];
						client.query(sql, params, cb);
						break;
					case "imagenActual":
						//Guardo la imagen en disco. 
						var img = req.body.imagenActual;
						var base = path.resolve(__dirname,'..','photos', req.session.uid.substr(0,1));
						var file = path.resolve(base, req.session.uid);
						async.auto({
							chkDir: function(cb) {
								if(fs.existsSync(base)) return cb();
								fs.mkdir(base, cb);
							},
							mkFile: ['chkDir', function(cb) {
								img = img.split(';');
								img[1] = img[1].split(',');
								img[0] = img[0].split('/');
								var type = img[0][1], data = new Buffer(img[1][1], 'base64');
								fs.writeFile(file, data, cb);
							}],
							saveDb: ['mkFile', function(cb) {
								var sql = 
									"update yacare.document_object doc "+
									"set 	name = $1::varchar "+
									"from 	yacare.physical_person pp "+
									"where 	pp.document_object_id = doc.id "+
									"		and pp.id = $1 "+
									"returning doc.id ";
								client.query(sql, [req.session.uid], function(err, result) {
									if(err) return cb(err);
									console.log(result);
									if(!result.rows.length) {
										var sql = 
											"insert into yacare.document_object "+
											"			(name) "+
											"values 	($1::varchar) "+
											"returning id ";
										client.query(sql, [req.session.uid], function(err, result) {
											if(err) return cb(err);
											if(!result.rows.length) {
												var sql = 
													"update yacare.physical_person "+
													"set 	document_object_id = $1 "+
													"where 	id = $2 ";
												client.query(sql, [result.rows[0].id, req.session.uid], cb);
											} else {
												cb('No se pudo guardar la foto.');
											}
										});
									} else {
										cb();
									}
								});
							}]
						}, cb);
						break;
					case "direccion_actual":
						var da = req.body.direccion_actual;
						var sql = "";
						var params = [];

						if(da.id) {

   							client.query(

   								"insert into yacare.city(id, state_enable, name, department_state_country_id) "+
   								"select uuid_generate_v4(), true, t.name, (select id from yacare.department_state_country where code='AR-X')::varchar "+
   								"from (select $1::varchar as name) as t "+
   								"left join yacare.city on yacare.city.name = t.name "+
   								"where yacare.city.name is null",

   								[da.ciudad.toUpperCase()], 

   								function(err, result) {
   									if(err) return cb(err);

   									client.query(
										"update yacare.address "+
										"	set city_id=(SELECT id FROM yacare.city WHERE name=$2 and department_state_country_id=(select id from yacare.department_state_country where code='AR-X')::varchar), "+
										"	district_comment=$3,"+
										"	street_comment=$4,"+
										"	number=$5,"+
										"	floor=$6,"+
										"	flat=$7,"+
										"	building=$8,"+
										"	postal_code=$9,"+
										"	comment=$10"+
										"	WHERE id=$1",

										params = [da.id, da.ciudad.toUpperCase(), da.barrio, da.calle, da.nro, da.piso,
										da.depto, da.edificio, da.cp, da.comment],	

										cb);
   								}
   							);
						} else {
							sql =
								"insert into yacare.address "+
								"		(id, city_id, district_comment, street_comment, number,floor,flat, building, postal_code, comment, state_enable) "+
								"values	($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true) "+
								"returning id";
							params = [
								uuid.v4(),
								da.ciudad_id,
								da.barrio,
								da.calle,
								da.nro,
								da.piso,
								da.depto,
								da.edificio,
								da.cp,
                da.comment
							];
							client.query(sql, params, function(err, result) {
								if(err) return cb(err);
								sql = 
									"insert into yacare.physical_person_address_list "+
									"		(address_id, physical_person_id) "+
									"values	($1, $2) ";
								client.query(sql, [result.rows[0].id, req.session.uid], cb);
							});
						}
						break;
					case "tutores":
						var ids = req.body.tutores.filter(function(item) {
							return item.id?true:false;
						}).map(function(item) {
							return item.id;
						});
						console.log(ids);
						async.series([
							function(cb) {
								//Elimino los tutores que fueron borrados
								var placeholders = ids.map(function(item, index) {
									return '$'+(index+2);
								});
								console.log(placeholders);
								ids.unshift(req.session.uid);
								var sql = 
									"update yacare.family_relationship rel "+
									"set 	state_enable = false "+
									"from 	yacare.physical_person_family_relationship_list list "+
									"where	list.physical_person_id = $1 "+
									"	and rel.id = list.family_relationship_id "+
									"	and rel.legal_responsibility=true "+
									(placeholders.length?"	and rel.physical_person_id not in ("+placeholders.join(',')+") ":"")+
									"returning rel.id";
								console.log(sql);
								client.query(sql, ids, function(err, result) {
									if(err) return cb(err);
									console.log(result);
									if(result.rows.length) {
										var params = [req.session.uid];
										var placeholders = [];
										result.rows.forEach(function(item, index) {
											params.push(item.id);
											placeholders.push('$'+(index+2));
										});
										var sql = 
											"delete from yacare.physical_person_family_relationship_list "+
											"where	physical_person_id = $1 "+
											"	and family_relationship_id in ("+placeholders.join(', ')+")";
										client.query(sql, params, cb);
									} else {
										cb();
									}
								});
									
							},
							function(cb) {
								//Creo o actualizo los tutores
								async.each(req.body.tutores, function(tutor, cb) {
									var sql = "";
									var params = [];
									async.auto({
										tutor: function(cb) {
											if(tutor.id) {
												sql = 
													"UPDATE yacare.physical_person "+
													"SET last_name=$2, name=$3, masculine=$4, birth_date=$5, "+
													"identification_type_person_id=$6, identification_number=$7, "+
													"country_id=$8 "+
													"WHERE id=$1";
												params = [
													tutor.id, 
													tutor.apellido, 
													tutor.nombre, 
													tutor.genero=='Hombre', 
													tutor.fecha_nacimiento, 
													tutor.tipo_documento_id, 
													tutor.nro_documento, 
													tutor.lugar_nacimiento||null
												];
												client.query(sql, params, function(err, result) {
													cb(err, tutor.id);
												});
											} else {
												sql =
													"insert into yacare.physical_person "+
													"	(id, last_name, name, masculine, birth_date, identification_type_person_id, "+
													"	identification_number, country_id, state_enable) "+
													"values ($1, $2, $3, $4, $5, $6, $7, $8, true) "+
													"returning id";
												params = [
													uuid.v4(),
													tutor.apellido, 
													tutor.nombre, 
													tutor.genero=='Hombre', 
													tutor.fecha_nacimiento, 
													tutor.tipo_documento_id, 
													tutor.nro_documento, 
													tutor.lugar_nacimiento||null
												];
												client.query(sql, params, function(err, result) {
													if(err) return cb(err);
													cb(null, result.rows[0].id);
												});	
											}
											
										},
										rf: ['tutor', function(cb, data) {
											//Relaciones familiares
											var sql =
												"update yacare.family_relationship fr "+
												"set 	family_relationship_type_id = $1 "+
												"from	yacare.physical_person_family_relationship_list l "+
												"where 	fr.physical_person_id = $2 "+
												"		and l.physical_person_id = $3 "+
												"returning fr.id";
											var params = [tutor.tipo_relacion_id, data.tutor, req.session.uid];
											client.query(sql, params, function(err, result) {
												if(err) return cb(err);
												if(!result.rows.length) {
													var sql = 
														"insert into yacare.family_relationship "+
														"		(id, family_relationship_type_id, physical_person_id, legal_responsibility, state_enable) "+
														"values ($1, $2, $3, true, true) "+
														"returning id";
													console.log(sql);
													var params = [uuid.v4(),tutor.tipo_relacion_id, data.tutor];
													console.log(params);
													client.query(sql, params, function(err, result) {
														if(err) return cb(err);
														var sql =
															"insert into yacare.physical_person_family_relationship_list "+
															"		(physical_person_id, family_relationship_id) "+
															"values ($1, $2)";
														client.query(sql, [req.session.uid, result.rows[0].id], cb);
													});
												} else {
													cb();
												}
											});
										}],
										dir: ['tutor', function(cb, data) {
											//Direccion actual
											var da = tutor.direccion_actual;
											if (!da) return cb();
                                            var sql = "";
	                                        var params = [];
        	                                if(da.id) {

      	                                		client.query(

					   								"insert into yacare.city(id, state_enable, name, department_state_country_id) "+
													"select uuid_generate_v4(), true, $2, "+
													"(select id from yacare.department_state_country where state_country_id=$1 order by name limit 1)::varchar "+
													"from (select $2::varchar as name) as t "+
													"WHERE NOT EXISTS "+
													"(SELECT C.* FROM YACARE.CITY C JOIN YACARE.department_state_country D ON C.department_state_country_ID = D.ID "+
													"JOIN YACARE.state_country SC ON SC.ID = D.state_country_id AND SC.ID = $1 "+
													"WHERE C.NAME = T.NAME)",

					   								[da.provincia_id, da.ciudad.toUpperCase()], 

					   								function(err, result) {
   														if(err) return cb(err);
   														sql = "UPDATE yacare.address a SET "+
		                                           					"city_id= ( "+
		                                           						"SELECT id " +
		                                           						"FROM yacare.city " +
		                                           						"WHERE name=$2::varchar and "+
		                                           							"department_state_country_id= ("+
			                                           							"select id "+
			                                           							"from yacare.department_state_country "+
			                                           							"where state_country_id=$11 order by name limit 1"+
		                                           							")"+
																	"), " +
				                                           			"district_comment=$3, "+
				                                           			"street_comment=$4, "+
				                                           			"number=$5, "+
				                                           			"floor=$6, "+
				                                           			"flat=$7, "+
				                                           			"building=$8, "+
				                                           			"postal_code=$9, "+
				                                           			"comment=$10 "+
				                                           		"where a.id=$1";

				                                        params = [
				                                            da.id, // $1
				                                            da.ciudad.toUpperCase(), // $2
				                                            da.barrio, // $3
				                                            da.calle, // $4
				                                            da.nro, // $5
				                                            da.piso, // $6
				                                            da.depto, // $7
				                                            da.edificio, // $8
				                                            da.cp, // $9
				                                            da.comentario, // $10
				                                            da.provincia_id // $11
				                                        ];
		                                        		client.query(sql, params, cb);
   													}
   												);

    	                                	} else {

    	                                		client.query(

    	                                			"insert into yacare.city(id, state_enable, name, department_state_country_id) "+
													"select uuid_generate_v4(), true, $2, "+
													"(select id from yacare.department_state_country where state_country_id=$1 order by name limit 1)::varchar "+
													"from (select $2::varchar as name) as t "+
													"WHERE NOT EXISTS "+
													"(SELECT C.* FROM YACARE.CITY C JOIN YACARE.department_state_country D ON C.department_state_country_ID = D.ID "+
													"JOIN YACARE.state_country SC ON SC.ID = D.state_country_id AND SC.ID = $1 "+
													"WHERE C.NAME = T.NAME)",

					   								[da.provincia_id, da.ciudad.toUpperCase()], 
					   								function(err, result) {
					   									if(err) return cb(err);
														sql =  "insert into yacare.address "+
                        	                        		   		"(id, city_id, district_comment, street_comment, number,floor,flat, building, postal_code, comment, state_enable) "+
                                	                		   "values" + 
                                	                		   		"($1, "+
                                	                		   		"(SELECT id FROM yacare.city WHERE name=$2 and "+
		                                           			   		"department_state_country_id=(select id from yacare.department_state_country where state_country_id=$11 order by name limit 1)), "+
                                	                		   		"$3, $4, $5, $6, $7, $8, $9, $10, true) "+
                                        	        		   		"returning id";
                                        	        	params = [
				                                            uuid.v4(),
				                                            da.ciudad.toUpperCase(),
				                                            da.barrio,
				                                            da.calle,
				                                            da.nro,
				                                            da.piso,
				                                            da.depto,
				                                            da.edificio,
				                                            da.cp,
				                                            da.comentario,
				                                            da.provincia_id
				                                        ];

				                                        client.query(
		                                        			sql, 
		                                        			params, 
		                                        			function(err, result) {
			        	                                        if(err) return cb(err);
			    	        	                                sql =
			        	        	                                "insert into yacare.physical_person_address_list "+
			                	        	                        "               (address_id, physical_person_id) "+
			                        	        	                "values ($1, $2) ";
			                                    	        	client.query(sql, [result.rows[0].id, data.tutor], cb);
                                                			}
		                                        		);
					   								});
    	                                	}
/*
					   								function(err, result) {
   														if(err) return cb(err);
   														sql =  "insert into yacare.address "+
                        	                        		   "(id, city_id, district_comment, street_comment, number,floor,flat, building, postal_code, comment, state_enable) "+
                                	                			"values ($1, (SELECT id FROM yacare.city WHERE name=$2 limit 1), $3, $4, $5, $6, $7, $8, $9, $10, true) "+
                                        	        			"returning id";
				                                        params = [
				                                            uuid.v4(),
				                                            da.ciudad.toUpperCase(),
				                                            da.barrio,
				                                            da.calle,
				                                            da.nro,
				                                            da.piso,
				                                            da.depto,
				                                            da.edificio,
				                                            da.cp,
				                                            da.comentario
				                                        ];

		                                        		client.query(
		                                        			sql, 
		                                        			params, 
		                                        			function(err, result) {
			        	                                        if(err) return cb(err);
			    	        	                                sql =
			        	        	                                "insert into yacare.physical_person_address_list "+
			                	        	                        "               (address_id, physical_person_id) "+
			                        	        	                "values ($1, $2) ";
			                                    	        	client.query(sql, [result.rows[0].id, data.tutor], cb);
                                                			}
		                                        		);
   													}
   												);

    	                                		
        	                                	sql =  "insert into yacare.address "+
                        	                        		   "(id, city_id, district_comment, street_comment, number,floor,flat, building, postal_code, comment, state_enable) "+
                                	                			"values ($1, (SELECT id FROM yacare.city WHERE name=$2 limit 1), $3, $4, $5, $6, $7, $8, $9, $10, true) "+
                                        	        			"returning id";
            	                                	
    	                                        params = [
    	                                        	uuid.v4(),
        	                                        da.ciudad,
                	                                da.barrio,
    	                	                        da.calle,
            	                	                da.nro,
                    	                	        da.piso,
                            	                	da.depto,
                                        	        da.edificio,
                                                	da.cp,
                                                  da.comentario
                                                ];
    	                                        client.query(sql, params, function(err, result) {
        	                                        if(err) return cb(err);
    	        	                                sql =
        	        	                                "insert into yacare.physical_person_address_list "+
                	        	                        "               (address_id, physical_person_id) "+
                        	        	                "values ($1, $2) ";
                                    	        	client.query(sql, [result.rows[0].id, data.tutor], cb);
                                                });	
												
											}*/
										}],
										phone: ['tutor', function(cb, data){
											//telefono
											if(!tutor.telefono) return cb();
											if(tutor.telefono_id) {
                                                sql =
                                                    "UPDATE yacare.phone "+
                                                    "SET name=$2 "+
                                                    "where id=$1";
                                                params = [
                                                    tutor.telefono_id,
                                                    tutor.telefono
                                                ];
                                                client.query(sql, params, cb);
			                                } else {
												sql =
                                                    "insert into yacare.phone "+
                                                    "       (id, name, state_enable, phone_type_id) "+
                                                    "values ($1, $2, true, '11936365-3352-47f8-a443-2da25c246088') "+
                                                    "returning id";
                                                params = [
                                                	uuid.v4(),
                                                    tutor.telefono
                                                ];
                                                client.query(sql, params, function(err, result) {
                                                    if(err) return cb(err);
                                                    sql =
                                                        "insert into yacare.physical_person_phone_list "+
                                                        "               (phone_id, physical_person_id) "+
                                                        "values ($1, $2) ";
                                                    client.query(sql, [result.rows[0].id, data.tutor], cb);
                                                });
                                            }
										}],
										email: ['tutor', function(cb, data){
											//email
											if(!tutor.mail) return cb();
											if(tutor.mail_id) {
                                                sql =
                                                    "UPDATE yacare.email "+
                                                    "SET name=$2 "+
                                                    "where id=$1";
                                                params = [
                                                    tutor.mail_id,
                                                    tutor.mail
                                                ];
                                                client.query(sql, params, cb);
                                            } else {
                                                sql =
                                                    "insert into yacare.email "+
                                                    "       (id, name, state_enable, email_type_id) "+
                                                    "values ($1, $2, true, 'c419aacd-c4e3-40d5-8ee1-689d6dfee8bb') "+
                                                    "returning id";
                                                params = [
                                                	uuid.v4(),
                                                    tutor.mail
                                                ];
                                                client.query(sql, params, function(err, result) {
                                                    if(err) return cb(err);
                                                    sql =
                                                        "insert into yacare.physical_person_email_list "+
                                                        "               (email_id, physical_person_id) "+
                                                        "values ($1, $2) ";
                                                    client.query(sql, [result.rows[0].id, data.tutor], cb);
                                                });
                                            }
										}]
									}, cb);
								}, cb);
							}
						], cb);
						break;
					case "contactos":
						var emgs = req.body.contactos;
						var ids = emgs.filter(function(item) {
							return item.tel_id?true:false;
						}).map(function(item) {
							return item.tel_id;
						});
						console.log(ids);
						async.series([
							function(cb) {
								var placeholders = ids.map(function(item, index) {
                                	return '$'+(index+2);
                                });
								console.log(placeholders);
                                ids.unshift(req.session.uid);
                                var sql =
	                                "update yacare.phone p "+
        	                        "set    state_enable = false "+
                	                "from   yacare.physical_person_phone_list list "+
                        	        "where  list.physical_person_id = $1 "+
                                	"       and p.id = list.phone_id "+
                                    (placeholders.length?"       and p.id not in ("+placeholders.join(',')+") ":"")+
                                    "returning p.id";
								console.log(sql);
                                client.query(sql, ids, function(err, result) {
    	                            if(err) return cb(err);
									console.log(result);
        	                        if(result.rows.length) {
            	                        var params = [req.session.uid];
                    	                var placeholders = [];
                            	        result.rows.forEach(function(item, index) {
                                	        params.push(item.id);
                                        	placeholders.push('$'+(index+2));
                                        });
                                        var sql =
                                            "delete from yacare.physical_person_phone_list "+
                                            "where  physical_person_id = $1 "+
                                            "       and phone_id in ("+placeholders.join(', ')+")";
    	                                client.query(sql, params, cb);
                	                } else {
                        	            cb();
                                	}
                                });
							},
							function(cb) {
								async.each(emgs, function(emg, cb) {
									var xml = {};
									for(var i in emg.xml) {
										xml[i] = {"$t": emg.xml[i] || " "}; 
									}
									if(emg.tel_id) {
										var sql = 
											"update yacare.phone "+
											"set	name = $1, comment=$2 "+
											"where	id = $3 ";
										var params = [emg.tel, xml2json.toXml({contact: xml}), emg.tel_id];
										console.log(sql);
										console.log(params);
										client.query(sql, params, function(err, result) {console.log(result); cb(err, result);});//cb);
									} else {
										var sql = 
											"insert into yacare.phone "+
											"	(id, name, comment, phone_type_id, state_enable) "+
											"values	($1, $2, $3, '11936365-3352-47f8-a443-2da25c246088', true) "+
											"returning id";
										var params = [uuid.v4(), emg.tel, xml2json.toXml({contact: xml})];
										client.query(sql, params, function(err, result) {
											if(err) return cb(err);
											var sql = 
												"insert into yacare.physical_person_phone_list "+
												"	(physical_person_id, phone_id) "+
												"values	($1, $2)";
											client.query(sql, [req.session.uid, result.rows[0].id], cb);
										});
									}
								}, cb);
							}
						],
						cb);
						break;
					default: 
						cb({message: 'No se encontró la clave '+item+' para guardar'});
				}
			}, cb);
			}], function(err, result) {
				if(err) {
					console.log(err);
					return client.query('rollback work', function() {
						client.end();
						next(err);
					});
				}
				client.query('commit work', function(err, result) {
					client.end();
					res.json({status: 'ok', message: 'Datos Guardados con éxito.'});
				});
			});
		});
	});

	router.use(function(err, req, res, next) {
		res.status(err.status||500).json({status: 'error', message: err.message||err});
	});

	return router;
};
