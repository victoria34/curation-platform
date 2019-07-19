'use strict';

/**
 * @ngdoc directive
 * @name oncokb.directive:refreshdate
 * @author Jing Su created on 2019/06/26
 * @description
 * # refresh date
 */
angular.module('oncokbApp')
    .directive('refreshDate', function(_, $timeout, mainUtils, DatabaseConnector, FirebaseModel, $rootScope, firebaseConnector) {
        return {
            templateUrl: 'views/refreshDate.html',
            restrict: 'E',
            scope: {
                type: '=',
                hugoSymbol: '=',
                key: '=',
                obj: '=',
                disabled: '=',
                updateTime: '=',
                updatedBy: '=',
                tipContent: '='
            },
            replace: false,
            link: function postLink(scope, element, attrs) {
            },
            controller: function($scope) {
                $scope.clicked = false;
                $scope.getIconClass = function(time) {
                    return mainUtils.getTimestampClass(time);
                };
                $scope.validateTime = function () {
                    $scope.clicked = true;
                    $scope.errorMessage = '';
                    if ($scope.type === 'tools') {
                        validateTimeInTools();
                    } else {
                        mainUtils.validateTime($scope.obj, $scope.key);
                        var historyData = {
                            hugoSymbol: $scope.hugoSymbol,
                            location: $scope.path,
                            operation: 'validateTime',
                            uuids: $scope.obj[$scope.key].uuid
                        };
                        DatabaseConnector.addHisotryRecord(historyData);
                        $scope.clicked = false;
                    }
                };
                function validateTimeInTools () {
                    var validateTimePath = [];
                    var historyDataArray = [];
                    var historyData = {
                        hugoSymbol: $scope.hugoSymbol,
                        operation: 'validateTime'
                    };
                    if ($scope.key === 'geneSummary') {
                        validateTimePath.push('summary_validateTime');
                        historyData['location'] = 'Gene Summary';
                        historyData['uuids'] = $scope.obj.uuid;
                        updateTimeForReviewedContentInTools(validateTimePath, [historyData]);
                    } else if ($scope.key === 'Gene Background') {
                        historyData['location'] = 'Gene Summary';
                        historyData['uuids'] = $scope.obj.uuid;
                        validateTimePath.push('background_validateTime');
                        updateTimeForReviewedContentInTools(validateTimePath, [historyData]);
                    } else if ($scope.key === 'geneType') {
                        historyData['location'] = 'Gene Type';
                        historyData['uuids'] = $scope.obj.effect_uuid + ', ' + $scope.obj.oncogenic_uuid;
                        validateTimePath.push('type/tsg_validateTime');
                        validateTimePath.push('type/ocg_validateTime');
                        updateTimeForReviewedContentInTools(validateTimePath, [historyData]);
                    } else if ($scope.key === 'mutationEffect') {
                        firebaseConnector.once("Genes/" + $scope.hugoSymbol + '/mutations').then(function(mutations) {
                            var mutationIndex = _.findIndex(mutations, function(item) {
                                return item.mutation_effect.effect_uuid === $scope.obj.effect_uuid || item.mutation_effect.oncogenic_uuid === $scope.obj.oncogenic_uuid;
                            });
                            if (mutationIndex > -1) {
                                historyData['location'] = mutations[mutationIndex].name + ', Mutation Effect';
                                historyData['uuids'] = $scope.obj.effect_uuid + ', ' + $scope.obj.oncogenic_uuid + ', ' + mutations[mutationIndex].mutation_effect.description_uuid;
                                validateTimePath.push('mutations/' + mutationIndex + '/mutation_effect/effect_validateTime');
                                validateTimePath.push('mutations/' + mutationIndex + '/mutation_effect/oncogenic_validateTime');
                                validateTimePath.push('mutations/' + mutationIndex + '/mutation_effect/description_validateTime');
                                updateTimeForReviewedContentInTools(validateTimePath, [historyData]);
                            } else {
                                $scope.errorMessage = 'Sorry, we cannot find this mutation.';
                            }
                        });
                    } else if ($scope.key === 'tumorSummary' || $scope.key === 'diagnosticSummary' || $scope.key === 'prognosticSummary'
                        || $scope.key === 'diagnosticImplication' || $scope.key === 'prognosticImplication') {
                        firebaseConnector.once("Genes/" + $scope.hugoSymbol + '/mutations').then(function(mutations) {
                            var tumorIndex = -1;
                            _.some(mutations, function(mutation, mutationIndex) {
                                if ('tumors' in mutation) {
                                    var queryKey = '';
                                    var queryObj = {};
                                    if ( $scope.key === 'tumorSummary' || $scope.key === 'diagnosticSummary' || $scope.key === 'prognosticSummary' ) {
                                        if ($scope.key === 'tumorSummary') {
                                            queryKey = 'summary';
                                            queryObj[queryKey + '_uuid'] = $scope.obj.summary_uuid;
                                        } else {
                                            queryKey = $scope.key;
                                            queryObj[$scope.key + '_uuid'] = $scope.obj.summary_uuid;
                                        }
                                        tumorIndex = _.findIndex(mutation.tumors, queryObj);
                                        if ( tumorIndex > -1) {
                                            var keyArray = $scope.key.match(/[A-Z][a-z]+/g);
                                            historyData['location'] = mutation.name + ', ' + mutation.tumors[tumorIndex].name + ', ' + _.upperFirst(keyArray[0]) + ' ' + keyArray[1];
                                            historyData['uuids'] = mutation.tumors[tumorIndex][queryKey + '_uuid'];
                                            validateTimePath.push('mutations/' + mutationIndex + '/tumors/' + tumorIndex + '/' + queryKey + '_validateTime');
                                            return true;
                                        }
                                    } else if ($scope.key === 'diagnosticImplication' || $scope.key === 'prognosticImplication') {
                                        if ($scope.key === 'diagnosticImplication') {
                                            queryKey = 'diagnostic';
                                        } else {
                                            queryKey = 'prognostic';
                                        }
                                        queryObj[queryKey + '_uuid'] = $scope.obj.implication_uuid;
                                        tumorIndex = _.findIndex(mutation.tumors, queryObj);
                                        if ( tumorIndex > -1) {
                                            historyData['location'] = mutation.name + ', ' + mutation.tumors[tumorIndex].name + ', ' + _.upperFirst(queryKey);
                                            historyData['uuids'] = mutation.tumors[tumorIndex][queryKey].description_uuid + ', ' + mutation.tumors[tumorIndex][queryKey].level_uuid;
                                            validateTimePath.push('mutations/' + mutationIndex + '/tumors/' + tumorIndex + '/' + queryKey + '/description_validateTime');
                                            validateTimePath.push('mutations/' + mutationIndex + '/tumors/' + tumorIndex + '/' + queryKey + '/level_validateTime');
                                            return true;
                                        }
                                    }
                                }
                            });
                            if (tumorIndex > -1) {
                                updateTimeForReviewedContentInTools(validateTimePath, [historyData]);
                            } else {
                                $scope.errorMessage = 'Sorry, we cannot find this tumor.';
                            }
                        });
                    } else if ($scope.key === 'ttsDrugs') {
                        firebaseConnector.once("Genes/" + $scope.hugoSymbol + '/mutations').then(function(mutations) {
                            var tumorIndex = -1;
                            var treatmentIndex = -1;
                            _.some(mutations, function (mutation, mutationIndex) {
                                if ('tumors' in mutation) {
                                    tumorIndex = _.findIndex(mutation.tumors, {summary_uuid: $scope.obj.summary_uuid});
                                    if (tumorIndex > -1) {
                                        historyData['location'] = mutation.name + ', ' + mutation.tumors[tumorIndex].name + ', Tumor Summary';
                                        historyData['uuids'] = mutation.tumors[tumorIndex].summary_uuid;
                                        historyDataArray.push(historyData);
                                        validateTimePath.push('mutations/' + mutationIndex + '/tumors/' + tumorIndex + '/summary_validateTime');
                                        if ('drugs' in $scope.obj) {
                                            var tis = mutations[mutationIndex].tumors[tumorIndex].TIs;
                                            _.some(tis, function (ti, tiIndex) {
                                                if ('treatment' in ti) {
                                                    treatmentIndex = _.findIndex(ti, {name_uuid: $scope.obj.treatment_name_uuid});
                                                    if (treatmentIndex > -1) {
                                                        historyData['location'] = mutation.name + ', ' + mutation.tumors[tumorIndex].name + ', ' + ti.name + ', ' + $scope.obj.treatment_name_uuid;
                                                        historyData['uuids'] = ti[tiIndex].treatments[treatmentIndex].level_uuid;
                                                        historyDataArray.push(historyData);
                                                        validateTimePath.push('mutations/' + mutationIndex + '/tumors/' +
                                                            tumorIndex + '/TIs' + tiIndex + '/treatments/' + treatmentIndex + '/level_validateTime');
                                                        return true;
                                                    }
                                                }
                                            });
                                        } else {
                                            return true;
                                        }
                                    }
                                }
                            });
                            if (validateTimePath.length > 0) {
                                updateTimeForReviewedContentInTools(validateTimePath, historyDataArray);
                            } else if (tumorIndex === -1) {
                                $scope.errorMessage = 'Sorry, we cannot find this tumor.';
                            } else if (treatmentIndex === -1 && 'drugs' in $scope.obj) {
                                $scope.errorMessage = 'Sorry, we cannot find this treatment.';
                            }
                        });
                    } else if ($scope.key === 'drugs') {
                        firebaseConnector.once("Genes/" + $scope.hugoSymbol + '/mutations').then(function(mutations) {
                            var treatmentIndex = -1;
                            _.some(mutations, function (mutation, mutationIndex) {
                                if ('tumors' in mutation) {
                                    _.some(mutation.tumors, function (tumor, tumorIndex) {
                                        _.some(tumor.TIs, function (ti, tiIndex) {
                                            if ('treatment' in ti) {
                                                treatmentIndex = _.findIndex(ti, {name_uuid: $scope.obj.treatment_name_uuid});
                                                if (treatmentIndex > -1) {
                                                    historyData['location'] = mutation.name + ', ' + tumor.name + ', ' + ti.name + ', ' + $scope.obj.treatment_name_uuid;
                                                    historyData['uuids'] = ti[tiIndex].treatments[treatmentIndex].level_uuid;
                                                    var path = 'mutations/' + mutationIndex + '/tumors/' + tumorIndex + '/TIs' + tiIndex + '/treatments/' + treatmentIndex;
                                                    validateTimePath.push(path + '/level_validateTime');
                                                    validateTimePath.push(path + '/description_validateTime');
                                                    validateTimePath.push(path + '/propagation_validateTime');
                                                    return true;
                                                }
                                            }
                                        });
                                    });
                                }
                            });
                            if (treatmentIndex > -1) {
                                updateTimeForReviewedContentInTools(validateTimePath, [historyData]);
                            } else {
                                $scope.errorMessage = 'Sorry, we cannot find this treatment.';
                            }
                        });
                    }
                };

                function updateTimeForReviewedContentInTools(validateTimePath, historyDataArray) {
                    var validateTimeObj = new FirebaseModel.Timestamp($rootScope.me.name);
                    _.forEach(validateTimePath, function(path) {
                        firebaseConnector.set("Genes/" + $scope.hugoSymbol + '/' + path, validateTimeObj).then(function(result) {
                            $scope.updateTime = validateTimeObj.updateTime;
                            $scope.clicked = false;
                            _.forEach(historyDataArray, function(historyData) {
                                DatabaseConnector.addHisotryRecord(historyData);
                            });
                        }, function (error) {
                            console.log("Error:", error);
                        });
                    });
                }
            }
        };
    });
