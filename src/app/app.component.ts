import { AfterViewInit, Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormGroup } from "@angular/forms";
import { Model } from "./Model";
import "rxjs/add/operator/debounceTime";
import { Subscription } from "rxjs/Subscription";

declare var $: any;

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {

    simulatorForm: FormGroup;
    model: Model;
    subscription: Subscription;

    constructor(private fb: FormBuilder) {
        this.simulatorForm = fb.group({
            dailyRevenue: 500,
            daysPerMonth: 17,
            otherMonthlyRevenue: 0,
            otherAnnualRevenue: 0,
            monthlyFees: 300,
            annualFees: 3500,
            monthlyGrossSalary: 0,
            annualBonus: 0,
            dividendsPercentage: 100,
	    dividendsFlatTax: true,
            familyReferenceRevenue: 36040 + 11220,
            familyQuotient: 3
        });
    }

    ngOnInit() {
        this.subscription = this.simulatorForm.valueChanges.debounceTime(50).subscribe(() => this.simulate());
        this.simulate();
    }
    ngOnDestroy() {
        this.subscription.unsubscribe();
    }
    ngAfterViewInit(): void {
        $(".ui.accordion").accordion();
        // $(".tooltip").popup();
    }

    simulate(): void {

        let newModel: Model = new Model();

        let params = this.simulatorForm.value;

        // Revenues
        newModel.dailyRevenue = params.dailyRevenue;
        newModel.daysPerMonth = params.daysPerMonth;
        newModel.annualRevenueFromRegularMonthlyRevenue = params.dailyRevenue * params.daysPerMonth * 12;
        newModel.otherMonthlyRevenue = params.otherMonthlyRevenue;
        newModel.annualRevenueFromOtherMonthlyRevenue = params.otherMonthlyRevenue * 12;
        newModel.otherAnnualRevenue = params.otherAnnualRevenue;
        newModel.totalAnnualRevenue = newModel.annualRevenueFromRegularMonthlyRevenue + newModel.annualRevenueFromOtherMonthlyRevenue + params.otherAnnualRevenue;

        // Fees
        newModel.monthlyFees = params.monthlyFees;
        newModel.annualFeesFromMonthlyFees = params.monthlyFees * 12;
        newModel.annualFees = params.annualFees;
        newModel.totalAnnualFees = (params.monthlyFees * 12) + params.annualFees;

        // Salary
        newModel.monthlyGrossSalary = params.monthlyGrossSalary;
        newModel.annualGrossSalary = (params.monthlyGrossSalary * 12);
        newModel.annualGrossBonus = params.annualBonus;
        newModel.totalAnnualGrossSalary = newModel.annualGrossSalary + newModel.annualGrossBonus;
	                                                                                 // Calcul en détail ici: https://www.urssaf.fr/portail/home/taux-et-baremes/taux-de-cotisations/les-employeurs/les-taux-de-cotisations-de-droit.html
                                                                                  	 // Taux ci-dessous sont des approximations ?                        
											 // A noter que le taux est toujours le taux max même si salaire au SMIC (aucunes réductions)         
        newModel.employerSalaryTax = Math.round(newModel.totalAnnualGrossSalary * 0.42); // Charge patronale sur le salaire brut (à ajout au brut pour constituer le superbrut) (Dougs parle de 58%)
        newModel.employeeSalaryTax = Math.round(newModel.totalAnnualGrossSalary * 0.22); // Charge salariale sur le salaire brut (à enlever au brut pour constituer le salaire net) (Dougs parle de 28%)
        newModel.annualSuperGrossSalary = newModel.totalAnnualGrossSalary + newModel.employerSalaryTax;
        newModel.annualNetSalary = newModel.totalAnnualGrossSalary - newModel.employeeSalaryTax;

        // Spendings
        newModel.totalAnnualSpendings = newModel.totalAnnualFees + newModel.annualSuperGrossSalary;

        // Profit
        newModel.grossProfit = newModel.totalAnnualRevenue - newModel.totalAnnualSpendings;
        newModel.profitTax = Math.max(0, Math.round(Math.min(newModel.grossProfit, 38120) * 0.15) // 15% jusqu'à 38120 euros
                            + Math.round(Math.max(newModel.grossProfit - 38120, 0) * 0.25)); // 25% au dela
			    //                                                               // ou à l'IR (seulement possible pendant 5 ans et déclenchable dans les 5 premières années): le salaire du
			    //                                                               // dirigeant n'est plus rentrée comme charge, il rentre la bénéfice dans son IR dans la case BNC et paye l'impôt
			    //                                                               // Attention à l'IR : risque avec l'ARE ? et pas de dividendes ?
        newModel.netProfit = newModel.grossProfit - newModel.profitTax;

        // Dividends
        newModel.dividendsPercentage = params.dividendsPercentage;
        newModel.dividendsFlatTax = params.dividendsFlatTax;
        newModel.grossDividends = Math.max(0, Math.round(newModel.netProfit * newModel.dividendsPercentage / 100));
	if (newModel.dividendsFlatTax) {
          // newModel.dividendsTax = Math.round(newModel.grossDividends * 0.30); // 30% de flat tax (17,2% cotisations + 12,8% d'impôt sur le revenu)
          newModel.dividendsTax = Math.round(newModel.grossDividends * 0.172); // Si couple avec Revenue Fiscal de Référence < 75000 euros
	                                                                       // A demander l'annnée d'avant : https://www.impots.gouv.fr/particulier/questions/puis-je-beneficier-dune-dispense-du-prelevement-forfaitaire-non-liberatoire
	} else {
          newModel.dividendsTax = Math.round(newModel.grossDividends * 0.172); // Uniquement 17,2% cotisations, le reste au barême progressif
	}
        newModel.netDividends = newModel.grossDividends - newModel.dividendsTax;
        newModel.investment = newModel.netProfit - newModel.grossDividends;

	// Revenues
	let referenceRevenue = newModel.annualNetSalary + params.familyReferenceRevenue;

        newModel.salaryRevenueTax = this.computeRevenueTax(referenceRevenue, newModel.dividendsFlatTax ? 0 : newModel.grossDividends, params.familyQuotient) 
                - this.computeRevenueTax(params.familyReferenceRevenue, 0, params.familyQuotient);

        // Shares
        newModel.totalFreelanceShare = newModel.annualNetSalary + newModel.netDividends - newModel.salaryRevenueTax;
        newModel.totalCompanyShare = newModel.investment;
        newModel.totalStateShare = newModel.employerSalaryTax + newModel.employeeSalaryTax + newModel.profitTax + newModel.dividendsTax + newModel.salaryRevenueTax;

        this.model = newModel;
    }

    computeRevenueTax(referenceRevenue: number, dividentsRevenue: number, quotient: number): number {
	let fiscalRevenue = referenceRevenue * 0.9; // Revenu Fiscal de Référence (abattement de 10%)
	fiscalRevenue += dividentsRevenue * (1 - 0.4 - 0.068); // Dividendes à l'IR (abattement de 40% + 6,8%), seulement possible pendant 5 ans et déclenchable dans les 5 premières années
        const baseRevenue = fiscalRevenue / quotient;
        const baseRevenueCouple = fiscalRevenue / 2;

	const SEUIL1 = 10225
	const SEUIL2 = 26070;
	const SEUIL3 = 74545;
	const SEUIL4 = 160336

        let tax = Math.min(SEUIL2 - SEUIL1, Math.max(baseRevenue - SEUIL1, 0)) * 0.11
        + Math.min(SEUIL3 - SEUIL2, Math.max(baseRevenue - SEUIL2, 0)) * 0.30
        + Math.min(SEUIL4 - SEUIL3, Math.max(baseRevenue - SEUIL3, 0)) * 0.41
        + Math.max(baseRevenue - SEUIL4, 0) * 0.45;

	tax = tax * quotient

        let taxCouple = Math.min(SEUIL2 - SEUIL1, Math.max(baseRevenueCouple - SEUIL1, 0)) * 0.11
        + Math.min(SEUIL3 - SEUIL2, Math.max(baseRevenueCouple - SEUIL2, 0)) * 0.30
        + Math.min(SEUIL4 - SEUIL3, Math.max(baseRevenueCouple - SEUIL3, 0)) * 0.41
        + Math.max(baseRevenueCouple - SEUIL4, 0) * 0.45;

	taxCouple = taxCouple * 2

	const PLAFONNEMENT_QF = 2*1592;
	const avantageQF = taxCouple - tax;

	if (avantageQF > PLAFONNEMENT_QF) {
	  tax = tax + avantageQF - PLAFONNEMENT_QF
	}

        return Math.round(tax);
    }
}
