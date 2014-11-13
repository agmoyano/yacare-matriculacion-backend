
module.exports = function(config) {
	var express = require('express');
	var router = express.Router();
	var pg = require('pg.js');
	var fs = require('fs');
	var path = require('path');
	var async = require('async');

	router.get('/exit', function(req, res, next) {
		req.session.destroy();
		res.send({status: 'ok', message: 'sesion destruida'});
	});

/*	router.post('/pregunta', function(req, res, next) {
		if(!req.body.doc) return next({status: 400, message: 'Nesecita ingresar el número de documento.'});
		req.session.pregunta = {};
		var preguntas = {
			dni: 'Número de documento', 
			cuit_cuil: 'CUIL',
			apellido: 'Apellido',
			nombre: 'Nombre',
			birth_date: {type: 'date', label:'Fecha de Nacimiento'},
			provincia_nac: {
				type: 'select', 
				label: 'Provincia de Nacimiento', 
				sql: 
					'select distinct sc.name as key, sc.name as val '+
					'from 	yacare.state_country sc '+
					'inner join '+
					'		yacare.department_state_country dsc '+
					'on 	sc.id=dsc.state_country_id '+
					'inner join '+
					'		yacare.city city '+
		   			'on		dsc.id=city.department_state_country_id '+
		   			'inner join '+
		   			'		yacare.physical_person pp '+
		   			'on 	pp.birth_address_id = city.id '+
		   			'order by 2'
		   	},
		   	city_nac: {
				type: 'select', 
				label: 'Ciudad de Nacimiento', 
				sql: 
					'select distinct city.name as key, city.name as val '+
					'from 	yacare.city city '+
		   			'inner join '+
		   			'		yacare.physical_person pp '+
		   			'on 	pp.birth_address_id = city.id '+
		   			'order by 2'
		   	},
			email: {type: 'email', label: 'Correo Electrónico'},
			'tutor.masculine': {type: 'select', label: 'Sexo', options: [{key: true, val: 'Masculino'}, {key: false, val: 'Femenino'}]},
			grupo_sang_code: {type: 'select', label: 'Grupo Sanguineo', sql: 'select code as key, name as val from yacare.blood_group order by 2'},
			factor_sang_code: {type: 'select', label: 'Factor Sanguineo', sql: 'select code as key, name as val from yacare.blood_factor order by 2'},
			barrio_dom_actual: 'Barrio Actual donde Vive',
			calle_actual: 'Calle Actual',
			nro_dom_actual: {type: 'number', label: 'Número de Domicilio Actual'},
			city_dom_actual: {
				type: 'select', 
				label: 'Ciudad Actual donde Vive',
				sql: 
					'select distinct city.name as key, city.name as val '+
					'from 	yacare.city city '+
		   			'inner join '+
		   			'		yacare.address aa '+
		   			'on 	city.id=aa.city_id '+
		   			'inner join '+
		   			'		yacare.physical_person_address_list ppl '+
		   			'on 		ppl.address_id=aa.id '+
		   			'where		aa.state_enable=true '+
		   			'order by 2'
		   	},
			provincia_dom_actual: {
				type: 'select', 
				label: 'Provincia Actual donde Vive', 
				sql: 
					'select distinct sc.name as key, sc.name as val '+
					'from 	yacare.state_country sc '+
					'inner join '+
					'		yacare.department_state_country dsc '+
					'on 	sc.id=dsc.state_country_id '+
					'inner join '+
					'		yacare.city city '+
		   			'on		dsc.id=city.department_state_country_id '+
		   			'inner join '+
		   			'		yacare.address aa '+
		   			'on 	city.id=aa.city_id '+
		   			'inner join '+
		   			'		yacare.physical_person_address_list ppl '+
		   			'on 		ppl.address_id=aa.id '+
		   			'where		aa.state_enable=true '+
		   			'order by 2'
		   		}
		};

		var pkeys = Object.keys(preguntas);
		var selected = [];
		var getRandom = function() {
			var r = Math.floor(Math.random() * pkeys.length);
			if(selected.indexOf(pkeys[r]) == -1) {
				selected.push(pkeys[r]);
			} else {
				getRandom();
			}
		};

		for(var i = 0; i < 3; i++) {
			getRandom();
		}

		var noUpCase = ['e', 'y', 'o', 'u', 'del', 'el', 'la', 'los', 'las', 'a', 'ante', 'bajo', 'con', 'contra', 'de', 'desde', 'en', 'entre', 'hacia', 'hasta', 'para', 'por', 'segun', 'sin', 'sobre', 'tras']

		var client = new pg.Client(config.pg.connStr);
		client.connect(function(err) {
			if(err) return next(err);
			var sql = fs.readFileSync(path.resolve(__dirname, '../sql', 'tutores.sql')).toString()+" where regexp_replace(lower(pp.identification_number), '[. -]+', '', 'g') = regexp_replace(lower($1), '[. -]+', '', 'g')";
			client.query(sql, [req.body.doc], function(err, result) {
				client.end();
				if(err) return next(err);
				if(result&&result.rows.length) {
					req.session.tutores = result.rows;
				} else {
					next({status: 401, message: 'Los datos ingresados no coinciden con los registros.'});
				}
			});
		});


		async.map(selected, function(key, cb){
			var obj = preguntas[key];
			if(typeof obj == 'string') {
				obj = {type: 'text', label: obj};
			} 
			if(obj.sql) {
				var client = new pg.Client(config.pg.connStr);
				client.connect(function(err) {
					if(err) return cb(err);
					client.query(obj.sql, function(err, result) {
						client.end();
						if(err) return cb(err);
						delete obj.sql;
						obj.options = result.rows;
						var distinct = [];
						async.map(obj.options, function(item, cb) {
							var val = item.val.toLowerCase().split(' ');
							val = val.map(function(word) {
								if(noUpCase.indexOf(word) == -1) {
									return word[0].toUpperCase()+word.substr(1);
								}
								return word;
							}).join(' ');
							val = val[0].toUpperCase()+val.substr(1);

							cb(null, {key: val, val: val});

						}, function(err, result) {
							async.filterSeries(result, function(item, cb) {
								if(distinct.indexOf(item.val) == -1) {
									distinct.push(item.val);
									cb(true);
								} else {
									cb(false);
								}
							}, function(result) {
								//console.log(result);
								obj.options = result;
								cb(null, {key: key, obj: obj});
							})
						});
					});
				});
			} else {
				cb(null, {key: key, obj: obj});
			}
		}, function(err, result){
			if(err) return next(err);
			result.forEach(function(item) {
				req.session.pregunta[item.key] = item.obj;
			});
			res.json(req.session.pregunta);
		});
	});*/

	router.post('/validar', function(req, res, next) {
		if(!req.body.doc||!req.body.nombre||!req.body.apellido||!req.body.dni) return next({status: 400, message: 'Faltan parámetros obligatorios.'});
		req.body['pp.identification_number'] = req.body.doc;
		delete req.body.doc;
		/*var params = [req.body.doc];
		var sql_add = ["regexp_replace(lower(pp.identification_number), '[. -]+', '', 'g') = regexp_replace(lower($1), '[. -]+', '', 'g')"];*/
		var params=[],
			sql_add=[], 
			n=1;
		
		console.log(req.body);
		for(var i in req.body) {
			//if(req.body[i]) {
				params.push(req.body[i]);
				sql_add.push("regexp_replace(lower("+i+"), '[. -_]+', '', 'g') = regexp_replace(lower($"+n+"), '[. -_]+', '', 'g')");
				n++;
			//}
		}
		//console.log(params);
		if(params.length < 3) {
			return next({status: 400, message: 'Debe contestar al menos 2 preguntas sobre un tutor.'});
		}
		var client = new pg.Client(config.pg.connStr);
		client.connect(function(err) {
			if(err) return next(err);
			var sql = fs.readFileSync(path.resolve(__dirname, '../sql', 'tutores.sql')).toString()+' where '+sql_add.join(' and ');
			client.query(sql, params, function(err, result) {
				client.end();
				if(err) return next(err);
				if(result&&result.rows.length) {
					req.session.uid = result.rows[0].physical_person_id;
					res.json({status: 'ok', message: 'Válido'});
				} else {
					next({status: 401, message: 'Los datos ingresados no coinciden con los registros.'});
				}
			});
		});
	});

	router.get('/alumno', function(req, res, next) {
		if(!req.session.uid) return next({status: 401, message: 'No esta autorizado para realizar esta acción.'});
		var client = new pg.Client(config.pg.connStr);
		client.connect(function(err) {
			if(err) return next(err);

			var sql = fs.readFileSync(path.resolve(__dirname, '../sql', 'datos_estudiantes.sql')).toString();
			client.query(sql, [req.session.uid], function(err, result) {
				client.end();
				if(err||!result||!result.rows.length) return next(err||{status: 401, message: 'No esta autorizado para realizar esta acción.'});
				res.json(result.rows[0]);
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
				res.json(result.rows);
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
				res.json(result.rows);
			});
		});
	});

	router.post('/guardar', function(req, res, next) {

	});

	router.use(function(err, req, res, next) {
		res.status(err.status||500).json({status: 'error', message: err.message});
	});

	return router;
};
