import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { UtilisateursComponent } from './utilisateurs.component';

describe('UtilisateursComponent', () => {
  let component: UtilisateursComponent;
  let fixture: ComponentFixture<UtilisateursComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UtilisateursComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(UtilisateursComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
